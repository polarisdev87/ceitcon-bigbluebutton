import Annotations from '/imports/api/annotations';

const ANNOTATION_CONFIG = Meteor.settings.public.whiteboard.annotations;
const DRAW_START = ANNOTATION_CONFIG.status.start;
const DRAW_END = ANNOTATION_CONFIG.status.end;

export default function removeRelatedAnnotations(annotationId) {
  Annotations.remove({id: annotationId, status: {$ne: DRAW_END}});
}
  