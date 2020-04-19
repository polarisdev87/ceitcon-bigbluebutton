import React from 'react';
import PropTypes from 'prop-types';
import { withTracker } from 'meteor/react-meteor-data';
import AnnotationGroupService from './service';
import AnnotationGroup from './component';

const AnnotationGroupContainer = props => (
  <AnnotationGroup
    annotationsInfo={props.annotationsInfo}
    slideWidth={props.width}
    slideHeight={props.height}
    whiteboardId={props.whiteboardId}
    eraserInfo={props.eraserInfo}
  />
);

export default withTracker((params) => {
  const { whiteboardId } = params;
  const annotationsInfo = AnnotationGroupService.getCurrentAnnotationsInfo(whiteboardId);
  var eraserInfo = [];
  if(annotationsInfo !== null && annotationsInfo.length > 0) {
    for(var i=0; i<annotationsInfo.length; i++) {
      eraserInfo.push(AnnotationGroupService.getAnnotationById(annotationsInfo[i]._id));
    }
  }
  return {
    annotationsInfo,
    eraserInfo
  };
})(AnnotationGroupContainer);

AnnotationGroupContainer.propTypes = {
  whiteboardId: PropTypes.string.isRequired,
  // initial width and height of the slide; required to calculate the annotations' coordinates
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  eraserInfo: PropTypes.array.isRequired,

  // array of annotations, optional
  annotationsInfo: PropTypes.arrayOf(PropTypes.shape({
    status: PropTypes.string.isRequired,
    _id: PropTypes.string.isRequired,
    annotationType: PropTypes.string.isRequired,
  })).isRequired,
};
