import React, { Component } from 'react';
import PropTypes, { nominalTypeHack } from 'prop-types';
import 'fabric-webpack';
import ReactiveAnnotationContainer from './reactive-annotation/container';
import AnnotationService from './service';
import AnnotationHelpers from './helpers';
import { fabric } from 'fabric-webpack';

const ANNOTATION_CONFIG = Meteor.settings.public.whiteboard.annotations;
const DRAW_END = ANNOTATION_CONFIG.status.end;

export default class AnnotationFactory extends Component {

  constructor() {
    super();
    this.state = {
      totalElem: 0,
      canvasStatic: null
    }
    this.updateStaticCanvas = this.updateStaticCanvas.bind(this);
  }

  componentDidMount() {
    const canvasStatic = this.canvasStatic;
    this.setState({ canvasStatic });
    this.updateStaticCanvas(this.props.annotationsInfo);
  }

  componentWillReceiveProps(nextProps) {
    // var staticItems = nextProps.annotationsInfo.filter(x => x.status == DRAW_END || x.annotationType == 'eraser');
    this.updateStaticCanvas(nextProps.annotationsInfo);
  }

  updateStaticCanvas(staticItems) {
    const { slideWidth, slideHeight } = this.props;
    const ctxStatic = this.canvasStatic.getContext('2d');
    ctxStatic.clearRect(0, 0, slideWidth, slideHeight);

    var annotationArray = [];
    var annotationVisible = new Array(staticItems.length).fill(1);

    console.log("factory staticitems", staticItems);

    if(staticItems) {
      staticItems.map((annotationDef, index) => {
        const annotation = AnnotationService.getAnnotationById(annotationDef._id);
        annotationArray.push(annotation);
      });

      console.log("factory annotationArray", annotationArray);

      annotationArray.map((annotation, index) => {
        if(annotation.annotationType == "elementEraser") { 
          for(let i = 0; i < index; i ++) {
            if(annotationArray[i].annotationType != "elementEraser" && annotationVisible[i]) {
              annotationVisible[i] = AnnotationHelpers.isDeletedAnnotation(annotation, annotationArray[i], slideWidth, slideHeight);
            }
          }
        }
      });
      annotationArray.map((annotation, index) => {
        if(annotationVisible[index]) {
          AnnotationHelpers.drawShape(canvasStatic, ctxStatic, annotation.annotationType, annotation.annotationInfo, slideWidth, slideHeight);  
        }
      });
    }
  }

  renderReactiveAnnotation(annotationInfo, slideWidth, slideHeight, whiteboardId) {
    return (
      <ReactiveAnnotationContainer
        key={annotationInfo._id}
        shapeId={annotationInfo._id}
        slideWidth={slideWidth}
        slideHeight={slideHeight}
        whiteboardId={whiteboardId}
      />
    );
  }

  render() {
    const { annotationsInfo, eraserInfo, slideWidth, slideHeight, whiteboardId } = this.props;

    // var reactiveItems = annotationsInfo.filter(x => x.status !== DRAW_END && x.annotationType !== 'eraser');
    return (
      <g>
        <foreignObject x="0" y="0" width={this.props.slideWidth} height={this.props.slideHeight}>
          <canvas
            id="canvasStatic"
            xmlns="http://www.w3.org/1999/xhtml"
            ref={(ref) => this.canvasStatic = ref}
            width={this.props.slideWidth}
            height={this.props.slideHeight}
          />
          {/* {reactiveItems
            ? reactiveItems.map(annotationInfo => this.renderReactiveAnnotation(annotationInfo, slideWidth, slideHeight, whiteboardId))
            : null } */}
        </foreignObject>
      </g>
    );
  }
}

AnnotationFactory.propTypes = {
  whiteboardId: PropTypes.string.isRequired,
  // initial width and height of the slide are required
  // to calculate the coordinates for each annotation
  slideWidth: PropTypes.number.isRequired,
  slideHeight: PropTypes.number.isRequired,

  // array of annotations, optional
  annotationsInfo: PropTypes.arrayOf(PropTypes.object).isRequired,
  eraserInfo: PropTypes.array.isRequired,
  annotationSelector: PropTypes.objectOf(PropTypes.func).isRequired,
};