import React from 'react';
import PropTypes from 'prop-types';
import AnnotationHelpers from '../helpers';

class ReactiveAnnotation extends React.Component {
  constructor() {
    super();
    this.updateCanvas = this.updateCanvas.bind(this);
  }

  componentDidMount() {
    this.updateCanvas();
  }

  componentDidUpdate() {
    this.updateCanvas();
  }

  updateCanvas() {
    const { slideWidth, slideHeight, annotation } = this.props;
    const ctxReactive = this.canvasReactive.getContext('2d');
    ctxReactive.clearRect(0, 0, slideWidth, slideHeight);

    AnnotationHelpers.drawShape(ctxReactive, annotation.annotationType, annotation.annotationInfo, slideWidth, slideHeight);
  }

  render() {

    return (
      <canvas
        id="canvasReactive"
        xmlns="http://www.w3.org/1999/xhtml"
        ref={(ref) => this.canvasReactive = ref}
        width={this.props.slideWidth}
        height={this.props.slideHeight}
        style={{
          position: 'absolute',
          top: '0',
          left: '0'
        }}
      />
    );
  }
};

ReactiveAnnotation.propTypes = {
  whiteboardId: PropTypes.string.isRequired,
  annotation: PropTypes.objectOf(PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.object,
  ])).isRequired,
  slideWidth: PropTypes.number.isRequired,
  slideHeight: PropTypes.number.isRequired,
};

export default ReactiveAnnotation;
