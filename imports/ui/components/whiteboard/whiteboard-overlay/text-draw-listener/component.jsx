import React, { Component } from 'react';
import PropTypes from 'prop-types';
import AnnotationHelper from '../../annotation-factory/helpers';
import AnnotationService from '../../annotation-factory/service';
import AnnotationGroupService from '../../annotation-group/service';
const ANNOTATION_CONFIG = Meteor.settings.public.whiteboard.annotations;
const DRAW_START = ANNOTATION_CONFIG.status.start;
const DRAW_UPDATE = ANNOTATION_CONFIG.status.update;
const DRAW_END = ANNOTATION_CONFIG.status.end;

// maximum value of z-index to prevent other things from overlapping
const MAX_Z_INDEX = (2 ** 31) - 1;

export default class TextDrawListener extends Component {
  constructor() {
    super();

    this.state = {
      // text shape state properties
      textBoxX: undefined,
      textBoxY: undefined,
      textBoxWidth: 0,
      textBoxHeight: 0,

      // to track the status of drawing
      isDrawing: false,

      // to track the status of writing a text shape after the textarea has been drawn
      isWritingText: false,
      isUpdatedText: false,
    };

    // initial mousedown coordinates
    this.initialX = undefined;
    this.initialY = undefined;

    // current X, Y, width and height in percentages of the current slide
    // saving them so that we won't have to recalculate these values on each update
    this.currentX = undefined;
    this.currentY = undefined;
    this.currentWidth = undefined;
    this.currentHeight = undefined;

    //text annotation array to check edit, and highlight text annotations.
    this.annotationArray = [];
    //current textarea text to add new text annotation.
    this.currentTextValue = '';
    this.updateTextValue = '';
    this.currentHighLightID = '';

    // current text shape status, it may change between DRAW_START, DRAW_UPDATE, DRAW_END
    this.currentStatus = '';
    

    // Mobile Firefox has a bug where e.preventDefault on touchstart doesn't prevent
    // onmousedown from triggering right after. Thus we have to track it manually.
    // In case if it's fixed one day - there is another issue, React one.
    // https://github.com/facebook/react/issues/9809
    // Check it to figure if you can add onTouchStart in render(), or should use raw DOM api
    this.hasBeenTouchedRecently = false;

    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleTextChange = this.handleTextChange.bind(this);
    this.resetState = this.resetState.bind(this);
    this.sendLastMessage = this.sendLastMessage.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleTouchCancel = this.handleTouchCancel.bind(this);
    this.checkTextAreaFocus = this.checkTextAreaFocus.bind(this);
  }

  componentDidMount() {
    window.addEventListener('beforeunload', this.sendLastMessage);
  }


  // If the activeId suddenly became empty - this means the shape was deleted
  // While the user was drawing it. So we are resetting the state.
  componentWillReceiveProps(nextProps) {
    const { drawSettings, whiteboardId, slideWidth, slideHeight} = this.props;
    const nextDrawsettings = nextProps.drawSettings;

    // initialize text annotation array for highlights and editable text
    // var annotationFullArray = [];

    // const staticItems = AnnotationGroupService.getCurrentAnnotationsInfo(whiteboardId);
    // staticItems.map((annotationDef, index) => {
    //   const annotation = AnnotationService.getAnnotationById(annotationDef._id);
    //   annotationFullArray.push(annotation);
    // });

    // var annotationVisible = new Array(annotationFullArray.length).fill(1);

    // annotationFullArray.map((annotation, index) => {
    //   if(annotation.annotationType == "elementEraser") { 
    //     for(let i = 0; i < index; i ++) {
    //       if(annotationFullArray[i].annotationType == "text" && annotationVisible[i]) {
    //         annotationVisible[i] = AnnotationHelper.isDeletedAnnotation(annotation, annotationFullArray[i], slideWidth, slideHeight);
    //       }
    //     }
    //   }
    // });

    // this.annotationArray = [];
    // annotationFullArray.map((annotation, index) => {
    //   if(annotation.annotationType == "text" && annotationVisible[index]) {
    //     this.annotationArray.push(annotation);
    //   }
    // });

    if (drawSettings.textShapeActiveId !== '' && nextDrawsettings.textShapeActiveId === '') {
      this.resetState();
    }
  }

  componentDidUpdate(prevProps) {
    const {
      drawSettings,
      actions,
    } = this.props;

    const {
      isDrawing
    } = this.state;

    //set focus to textarea
    if(isDrawing) {
      setTimeout(() => {
        var element = document.getElementById("textDrawArea");
        element.focus();
        element.setSelectionRange(element.value.length,element.value.length);
      }, 100);        
    }

    const prevDrawsettings = prevProps.drawSettings;
    const prevTextShapeValue = prevProps.drawSettings.textShapeValue;

    // Updating the component in cases when:
    // Either color / font-size or text value has changed
    // and excluding the case when the textShapeActiveId changed to ''
    const fontSizeChanged = drawSettings.textFontSize !== prevDrawsettings.textFontSize;
    const colorChanged = drawSettings.color !== prevDrawsettings.color;
    const textShapeValueChanged = drawSettings.textShapeValue !== prevTextShapeValue;
    const textShapeIdNotEmpty = drawSettings.textShapeActiveId !== '';

    if ((fontSizeChanged || colorChanged || textShapeValueChanged) && textShapeIdNotEmpty) {
      const { getCurrentShapeId } = actions;
      this.currentStatus = DRAW_UPDATE;

      this.handleDrawText(
        { x: this.currentX, y: this.currentY },
        this.currentWidth,
        this.currentHeight,
        this.currentStatus,
        getCurrentShapeId(),
        drawSettings.textShapeValue,
      );
    }
  }

  componentWillUnmount() {
    window.removeEventListener('beforeunload', this.sendLastMessage);
    // sending the last message on componentDidUnmount
    // for example in case when you switched a tool while drawing text shape
    this.sendLastMessage();
  }

  // checks if the input textarea is focused or not, and if not - moves focus there
  // returns false if text area wasn't focused
  // returns true if textarea was focused
  // currently used only with iOS devices
  checkTextAreaFocus() {
    const {
      actions,
    } = this.props;

    const { getCurrentShapeId } = actions;

    const textarea = document.getElementById(getCurrentShapeId());

    if (textarea) {
      if (document.activeElement === textarea) {
        return true;
      }
      textarea.focus();
    }

    return false;
  }

  handleTouchStart(event) {
    const {
      isDrawing,
      isWritingText,
    } = this.state;

    this.hasBeenTouchedRecently = true;
    setTimeout(() => { this.hasBeenTouchedRecently = false; }, 500);
    // to prevent default behavior (scrolling) on devices (in Safari), when you draw a text box
    event.preventDefault();


    // if our current drawing state is not drawing the box and not writing the text
    if (!isDrawing && !isWritingText) {
      window.addEventListener('touchend', this.handleTouchEnd, { passive: false });
      window.addEventListener('touchmove', this.handleTouchMove, { passive: false });
      window.addEventListener('touchcancel', this.handleTouchCancel, true);

      const { clientX, clientY } = event.changedTouches[0];
      this.commonDrawStartHandler(clientX, clientY);

    // this case is specifically for iOS, since text shape is working in 3 steps there:
    // touch to draw a box -> tap to focus -> tap to publish
    } else if (!isDrawing && isWritingText && !this.checkTextAreaFocus()) {

    // if you switch to a different window using Alt+Tab while mouse is down and release it
    // it wont catch mouseUp and will keep tracking the movements. Thus we need this check.
    } else {
      this.sendLastMessage();
    }
  }

  handleTouchMove(event) {
    event.preventDefault();
    const { clientX, clientY } = event.changedTouches[0];
    this.commonDrawMoveHandler(clientX, clientY);
  }

  handleTouchEnd() {
    window.removeEventListener('touchend', this.handleTouchEnd, { passive: false });
    window.removeEventListener('touchmove', this.handleTouchMove, { passive: false });
    window.removeEventListener('touchcancel', this.handleTouchCancel, true);
    this.commonDrawEndHandler();
  }

  handleTouchCancel() {
    window.removeEventListener('touchend', this.handleTouchEnd, { passive: false });
    window.removeEventListener('touchmove', this.handleTouchMove, { passive: false });
    window.removeEventListener('touchcancel', this.handleTouchCancel, true);
    this.commonDrawEndHandler();
  }

  // main mouse down handler
  handleMouseDown(event) {
    const {
      isDrawing,
    } = this.state;

    const {
      actions,
    } = this.props;

    const {
      getTransformedSvgPoint,
    } = actions;

    const isLeftClick = event.button === 0;
    const isRightClick = event.button === 2;

    if (this.hasBeenTouchedRecently) {
      return;
    }

    const { clientX, clientY } = event;

    // escape from editing status
    if(isDrawing && isLeftClick) {
      // Set tempdiv content with current textarea text
      var textTempDiv = document.getElementById("textDrawTempDiv");      
      var textDrawValue = this.textDrawValue.value;
      textTempDiv.innerHTML = textDrawValue;
      this.currentTextValue = textDrawValue;
      // Confirm clicked point is in text area
      const transformedSvgPoint = getTransformedSvgPoint(clientX, clientY);
      if(transformedSvgPoint.x < this.initialX || transformedSvgPoint.x > this.initialX + textTempDiv.clientWidth || transformedSvgPoint.y < this.initialY || transformedSvgPoint.y > this.initialY + textTempDiv.clientHeight)
      {
        // If clicked point is not in text area
        this.setState({
          textBoxWidth: textTempDiv.clientWidth,
          textBoxHeight: textTempDiv.clientHeight,
          isUpdatedText: false
        });
        this.customDrawEndHandler(textTempDiv.clientWidth, textTempDiv.clientHeight);
        return;
      }
    }

    if (isDrawing && isRightClick) {
      this.discardAnnotation();
    }

    // if our current drawing state is not drawing the box and not writing the text
    if (!isDrawing) {
      if (isLeftClick) {
        // window.addEventListener('mouseup', this.handleMouseUp);
        // window.addEventListener('mousemove', this.handleMouseMove, true);
        if(this.currentHighLightID == '') {
          this.commonDrawStartHandler(clientX, clientY);
        } 
        else {
          // this.annotationArray.map((annotation, index) => {
          //   if(annotation._id == this.currentHighLightID) {
          //     //remove highlight
          //     var outerDiv = document.getElementById("textDrawOuterDiv");
          //     outerDiv.style.display = 'none';
          //     this.currentHighLightID = '';
          //     //open textarea with previous text
          //     var pixelX = annotation.annotationInfo.x / 100 * slideWidth;
          //     var pixelY = annotation.annotationInfo.y / 100 * slideHeight;
          //     this.initialX = pixelX;
          //     this.initialY = pixelY;
          //     this.updateTextValue = annotation.annotationInfo.text;

          //     const removedPoint = [annotation.annotationInfo.x + 0.005, annotation.annotationInfo.y + 0.005];
          //     this.addTextElementEraser(removedPoint, DRAW_END, generateNewShapeId());

          //     this.setState({
          //       textBoxX: pixelX,
          //       textBoxY: pixelY,
          //       isDrawing: true,
          //       isUpdatedText: true
          //     });
          //   }
          // });
        }
      }

    // second case is when a user finished writing the text and publishes the final result
    } else {
      // publishing the final shape and resetting the state
      // this.sendLastMessage();
      // if (isRightClick) {
      //   this.discardAnnotation();
      // }
    }
  }

  // main mouse move handler
  handleMouseMove(event) {

    const { clientX, clientY } = event;
    const {
      slideWidth,
      slideHeight,
      actions,
    } = this.props;

    const {
      getTransformedSvgPoint,
    } = actions;

    const {
      isDrawing,
    } = this.state;

    if(isDrawing) {
      return;
    }

    // var transformedSvgPoint = getTransformedSvgPoint(clientX, clientY);
    // transformedSvgPoint.x = transformedSvgPoint.x / slideWidth * 100;
    // transformedSvgPoint.y = transformedSvgPoint.y / slideHeight * 100;
    // var outerDiv = document.getElementById("textDrawOuterDiv");
    // outerDiv.style.display = 'none';
    // this.currentHighLightID = '';

    // this.annotationArray.map((annotation, index) => {
    //   if(annotation.annotationInfo.x <= transformedSvgPoint.x &&  transformedSvgPoint.x <= annotation.annotationInfo.x + annotation.annotationInfo.textBoxWidth && annotation.annotationInfo.y <= transformedSvgPoint.y &&  transformedSvgPoint.y <= annotation.annotationInfo.y + annotation.annotationInfo.textBoxHeight) {
    //     outerDiv.style.display = 'inline-block';
    //     outerDiv.style.left = annotation.annotationInfo.x + '%';
    //     outerDiv.style.top = annotation.annotationInfo.y + '%';
    //     outerDiv.style.width = annotation.annotationInfo.textBoxWidth + '%';
    //     outerDiv.style.height = annotation.annotationInfo.textBoxHeight + '%';
    //     this.currentHighLightID = annotation._id;
    //     return;
    //   }
    // });
    // this.commonDrawMoveHandler(clientX, clientY);
  }

  // main mouse up handler
  handleMouseUp() {
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('mousemove', this.handleMouseMove, true);
    // this.commonDrawEndHandler();
  }

  commonDrawStartHandler(clientX, clientY) {
    const {
      actions,
      slideWidth,
      slideHeight,
    } = this.props;

    const {
      getTransformedSvgPoint,
    } = actions;

    // saving initial X and Y coordinates for further displaying of the textarea
    const transformedSvgPoint = getTransformedSvgPoint(clientX, clientY);

    this.initialX = transformedSvgPoint.x;
    this.initialY = transformedSvgPoint.y;
    this.currentX = transformedSvgPoint.x / slideWidth * 100;
    this.currentY = transformedSvgPoint.y / slideHeight * 100;

    this.setState({
      textBoxX: transformedSvgPoint.x,
      textBoxY: transformedSvgPoint.y,
      isDrawing: true,
    });
  }

  commonDrawMoveHandler(clientX, clientY) {
    const {
      actions,
    } = this.props;
    const {
      checkIfOutOfBounds,
      getTransformedSvgPoint,
    } = actions;

    // get the transformed svg coordinate
    let transformedSvgPoint = getTransformedSvgPoint(clientX, clientY);

    // check if it's out of bounds
    transformedSvgPoint = checkIfOutOfBounds(transformedSvgPoint);

    // check if we need to use initial or new coordinates for the top left corner of the rectangle
    const x = transformedSvgPoint.x < this.initialX ? transformedSvgPoint.x : this.initialX;
    const y = transformedSvgPoint.y < this.initialY ? transformedSvgPoint.y : this.initialY;

    // calculating the width and height of the displayed text box
    const width = transformedSvgPoint.x > this.initialX
      ? transformedSvgPoint.x - this.initialX : this.initialX - transformedSvgPoint.x;
    const height = transformedSvgPoint.y > this.initialY
      ? transformedSvgPoint.y - this.initialY : this.initialY - transformedSvgPoint.y;

    this.setState({
      textBoxWidth: width,
      textBoxHeight: height,
      textBoxX: x,
      textBoxY: y,
    });
  }

  commonDrawEndHandler() {
    const {
      actions,
      slideWidth,
      slideHeight,
    } = this.props;

    const {
      isDrawing,
      isWritingText,
      textBoxX,
      textBoxY,
      textBoxWidth,
      textBoxHeight,
    } = this.state;

    // TODO - find if the size is large enough to display the text area
    if (!isDrawing && isWritingText) {
      return;
    }

    const {
      generateNewShapeId,
      getCurrentShapeId,
      setTextShapeActiveId,
    } = actions;

    // coordinates and width/height of the textarea in percentages of the current slide
    // saving them in the class since they will be used during all updates
    this.currentX = (textBoxX / slideWidth) * 100;
    this.currentY = (textBoxY / slideHeight) * 100;
    this.currentWidth = (textBoxWidth / slideWidth) * 100;
    this.currentHeight = (textBoxHeight / slideHeight) * 100;
    this.currentStatus = DRAW_START;
    this.handleDrawText(
      { x: this.currentX, y: this.currentY },
      this.currentWidth,
      this.currentHeight,
      this.currentStatus,
      generateNewShapeId(),
      '',
    );
    this.updateTextValue = '';
    this.currentHighLightID = '';

    setTextShapeActiveId(getCurrentShapeId());

    this.setState({
      isWritingText: true,
      isDrawing: false,
      textBoxX: undefined,
      textBoxY: undefined,
      textBoxWidth: 0,
      textBoxHeight: 0,
      isUpdatedText: false
    });
  }
  
  // Difference between commonDrawEndHandler & customDrawEndHandler
  // customDrawEndHandler has different parameters from commonDrawEndHandler
  customDrawEndHandler(textBoxWidth, textBoxHeight) {
    const {
      actions,
      slideWidth,
      slideHeight,
    } = this.props;

    const {
      isDrawing,
      isWritingText,
      textBoxX,
      textBoxY
    } = this.state;

    // TODO - find if the size is large enough to display the text area
    if (!isDrawing && isWritingText) {
      return;
    }

    const {
      generateNewShapeId,
      getCurrentShapeId,
      setTextShapeActiveId,
    } = actions;

    // coordinates and width/height of the textarea in percentages of the current slide
    // saving them in the class since they will be used during all updates
    this.currentWidth = (textBoxWidth / slideWidth) * 100;
    this.currentHeight = (textBoxHeight / slideHeight) * 100;
    this.currentStatus = DRAW_END;
    this.handleDrawText(
      { x: this.currentX, y: this.currentY },
      this.currentWidth,
      this.currentHeight,
      this.currentStatus,
      generateNewShapeId(),
      this.currentTextValue
    );

    setTextShapeActiveId(getCurrentShapeId());
  }

  // Add element eraser annotation for editable text
  addTextElementEraser(points, status, id) {
    console.log("addTextElementEraser");
    const {
      whiteboardId,
      userId,
      actions,
      drawSettings,
    } = this.props;

    const {
      normalizeThickness,
      sendAnnotation,
    } = actions;

    const {
      thickness,
      color,
    } = drawSettings;

    const annotation = {
      id,
      status,
      annotationType: 'elementEraser',
      annotationInfo: {
        color,
        thickness: normalizeThickness(thickness),
        points,
        id,
        whiteboardId,
        status,
        type: 'elementEraser',
      },
      wbId: whiteboardId,
      userId,
      position: 0,
    };

    sendAnnotation(annotation, whiteboardId);
  }

  //main textare change handler
  handleTextChange(e) {
    // const {
    //   textBoxX,
    //   textBoxY,
    //   isDrawing
    // } = this.state;
    // const {
    //   actions,
    //   slideWidth,
    //   slideHeight,
    // } = this.props;

    // if(!isDrawing) return;

    // this.currentStatus = DRAW_UPDATE;
    // const {
    //   generateNewShapeId,
    //   getCurrentShapeId,
    //   setTextShapeActiveId,
    // } = actions;

    // this.currentX = (textBoxX / slideWidth) * 100;
    // this.currentY = (textBoxY / slideHeight) * 100;
    // this.handleDrawText(
    //   { x: this.currentX, y: this.currentY },
    //   0, 0,
    //   this.currentStatus,
    //   generateNewShapeId(),
    //   e.target.value,
    // );
  }

  handleDrawText(startPoint, width, height, status, id, text) {
    const {
      whiteboardId,
      userId,
      actions,
      drawSettings,
    } = this.props;

    const {
      normalizeFont,
      sendAnnotation,
    } = actions;

    const {
      color,
      textFontSize,
    } = drawSettings;

    const annotation = {
      id,
      status,
      annotationType: 'text',
      annotationInfo: {
        x: startPoint.x, // left corner
        y: startPoint.y, // left corner
        fontColor: color,
        calcedFontSize: normalizeFont(textFontSize), // fontsize
        textBoxWidth: width, // width
        text,
        textBoxHeight: height, // height
        id,
        whiteboardId,
        status,
        fontSize: textFontSize,
        dataPoints: `${startPoint.x},${startPoint.y}`,
        type: 'text',
      },
      wbId: whiteboardId,
      userId,
      position: 0,
    };

    if(annotation.status == "DRAW_END") {
      this.annotationArray.push(annotation);
    }

    sendAnnotation(annotation, whiteboardId);
  }

  sendLastMessage() {
    const {
      drawSettings,
      actions,
    } = this.props;

    // const {
    //   isWritingText,
    // } = this.state;

    // if (!isWritingText) {
    //   return;
    // }

    const {
      getCurrentShapeId,
    } = actions;

    this.currentStatus = DRAW_END;

    this.handleDrawText(
      { x: this.currentX, y: this.currentY },
      this.currentWidth,
      this.currentHeight,
      this.currentStatus,
      getCurrentShapeId(),
      this.currentTextValue
    );

    this.resetState();
  }

  resetState() {
    const {
      actions,
    } = this.props;
    // resetting the current drawing state
    // window.removeEventListener('mouseup', this.handleMouseUp);
    // window.removeEventListener('mousemove', this.handleMouseMove, true);
    // touchend, touchmove and touchcancel are removed on devices
    // window.removeEventListener('touchend', this.handleTouchEnd, { passive: false });
    // window.removeEventListener('touchmove', this.handleTouchMove, { passive: false });
    // window.removeEventListener('touchcancel', this.handleTouchCancel, true);

    // resetting the text shape session values
    actions.resetTextShapeSession();
    // resetting the current state
    this.currentX = undefined;
    this.currentY = undefined;
    this.currentWidth = undefined;
    this.currentHeight = undefined;
    this.currentStatus = '';
    this.initialX = undefined;
    this.initialY = undefined;

    this.currentTextValue = '';
    this.updateTextValue = '';
    this.currentHighLightID = '';

    this.setState({
      isDrawing: false,
      isWritingText: false,
      textBoxX: undefined,
      textBoxY: undefined,
      textBoxWidth: 0,
      textBoxHeight: 0,
      isUpdatedText: false
    });
  }

  discardAnnotation() {
    const {
      whiteboardId,
      actions,
    } = this.props;

    const {
      getCurrentShapeId,
      addAnnotationToDiscardedList,
      undoAnnotation,
    } = actions;

    undoAnnotation(whiteboardId);
    addAnnotationToDiscardedList(getCurrentShapeId());
  }

  render() {
    const {
      actions,
      drawSettings
    } = this.props;

    const {
      textBoxX,
      textBoxY,
      textBoxWidth,
      textBoxHeight,
      isWritingText,
      isDrawing,
      isUpdatedText
    } = this.state;

    const { contextMenuHandler } = actions;
    const initialX = this.initialX == undefined? 0 : this.initialX;
    const initialY = this.initialY == undefined? 0 : this.initialY;

    const baseName = Meteor.settings.public.app.cdn + Meteor.settings.public.app.basename;
    const textDrawStyle = {
      width: '100%',
      height: '100%',
      touchAction: 'none',
      zIndex: MAX_Z_INDEX,
      cursor: `url('${baseName}/resources/images/whiteboard-cursor/text.png'), default`,
    };

    const textDrawAreaStyle = {
      position: 'absolute',
      left: initialX + 'px',
      top: initialY + 'px',
      width: 'calc(100% - ' + initialX + 'px)',
      height: 'calc(100% - ' + initialY + 'px)',
      touchAction: 'none',
      zIndex: MAX_Z_INDEX,
      border: 'none',
      outline: 'none',
      padding: '0px',
      overflow: 'hidden',
      background: 'transparent',
      fontFamily: 'Arial, sans-serif',
      color: AnnotationHelper.getFormattedColor(drawSettings.color),
      fontSize: drawSettings.textFontSize,
      lineHeight: 1,
      whiteSpace: 'nowrap'
    };

    const textDrawTempStyle = {
      display: 'inline-block',
      visibility: 'hidden',
      border: 'none',
      outline: 'none',
      padding: '0px',
      overflow: 'hidden',
      maxWidth: 'calc(100% - ' + initialX + 'px)',
      maxHeight: 'calc(100% - ' + initialY + 'px)',
      fontFamily: 'Arial, sans-serif',
      fontSize: drawSettings.textFontSize,
      lineHeight: 1,
      whiteSpace: 'pre-wrap'
    };

    const textDrawOuterStyle = {
      display: 'none',
      position: 'absolute',
      zIndex: MAX_Z_INDEX - 1,
      border: '3px dashed green',
      marginTop: '-5px',
    };

    return (
      <div
        role="presentation"
        style={textDrawStyle}
        onMouseDown={this.handleMouseDown}
        onMouseMove={this.handleMouseMove}
        onTouchStart={this.handleTouchStart}
        onContextMenu={contextMenuHandler}
      >
        {isDrawing
            ? (
              <textarea id="textDrawArea" spellCheck="false" style={textDrawAreaStyle} ref={e => this.textDrawValue = e} defaultValue={isUpdatedText ? this.updateTextValue : ''} onChange={this.handleTextChange}/>
          )
          : null }
          <div id="textDrawTempDiv" style={textDrawTempStyle}></div>
          <div id="textDrawOuterDiv" style={textDrawOuterStyle}></div>
      </div>
    );
  }
}

TextDrawListener.propTypes = {
  // Defines a whiteboard id, which needed to publish an annotation message
  whiteboardId: PropTypes.string.isRequired,
  // Defines a user id, which needed to publish an annotation message
  userId: PropTypes.string.isRequired,
  // Width of the slide (svg coordinate system)
  slideWidth: PropTypes.number.isRequired,
  // Height of the slide (svg coordinate system)
  slideHeight: PropTypes.number.isRequired,
  // Current draw settings passed from the toolbar and text shape (text value)
  drawSettings: PropTypes.shape({
    // Annotation color
    color: PropTypes.number.isRequired,
    // Font size for the text shape
    textFontSize: PropTypes.number.isRequired,
    // Current active text shape value
    textShapeValue: PropTypes.string.isRequired,
    // Text active text shape id
    textShapeActiveId: PropTypes.string.isRequired,
  }).isRequired,
  actions: PropTypes.shape({
    // Defines a function which transforms a coordinate from the window to svg coordinate system
    getTransformedSvgPoint: PropTypes.func.isRequired,
    // Defines a function which checks if the shape is out of bounds and returns
    // appropriate coordinates
    checkIfOutOfBounds: PropTypes.func.isRequired,
    // Defines a function which returns a current shape id
    getCurrentShapeId: PropTypes.func.isRequired,
    // Defines a function which generates a new shape id
    generateNewShapeId: PropTypes.func.isRequired,
    // Defines a function which receives a thickness num and normalizes it before we send a message
    normalizeFont: PropTypes.func.isRequired,
    // Defines a function which we use to publish a message to the server
    sendAnnotation: PropTypes.func.isRequired,
    // Defines a function which resets the current state of the text shape drawing
    resetTextShapeSession: PropTypes.func.isRequired,
    // Defines a function that sets a session value for the current active text shape
    setTextShapeActiveId: PropTypes.func.isRequired,
  }).isRequired,
};
