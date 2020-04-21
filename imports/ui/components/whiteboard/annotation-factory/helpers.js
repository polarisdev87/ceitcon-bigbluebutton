import { fabric } from 'fabric-webpack';

const ANNOTATION_CONFIG = Meteor.settings.public.whiteboard.annotations;
const DRAW_END = ANNOTATION_CONFIG.status.end;

const colourToHex = (value) => {
    let hex;
    hex = parseInt(value, 10).toString(16);
    while (hex.length < 6) {
        hex = `0${hex}`;
    }

    return `#${hex}`;
};

const getFormattedColor = (color) => {
    let _color = color || '0';

    if (!_color.toString().match(/#.*/)) {
        _color = colourToHex(_color);
    }

    return _color;
};

const getStrokeWidth = (thickness, slideWidth) => (thickness * slideWidth) / 100;

const getLineCoordinates = (points, slideWidth, slideHeight) => {
    const x1 = (points[0] / 100) * slideWidth;
    const y1 = (points[1] / 100) * slideHeight;
    const x2 = (points[2] / 100) * slideWidth;
    const y2 = (points[3] / 100) * slideHeight;

    return {
        x1,
        y1,
        x2,
        y2,
    };
}

const getTriangleCoordinates = (points, slideWidth, slideHeight) => {
    // points[0] and points[1] are x and y coordinates of the top left corner of the annotation
    // points[2] and points[3] are x and y coordinates of the bottom right corner of the annotation
    var xBottomLeft = points[0];
    var yBottomLeft = points[3];
    var xBottomRight = points[2];
    var yBottomRight = points[3];
    var xTop = ((xBottomRight - xBottomLeft) / 2) + xBottomLeft;
    var yTop = points[1];

    var xTop = (xTop / 100) * slideWidth;
    var yTop = (yTop / 100) * slideHeight;
    var xBottomLeft = (xBottomLeft / 100) * slideWidth;
    var yBottomLeft = (yBottomLeft / 100) * slideHeight;
    var xBottomRight = (xBottomRight / 100) * slideWidth;
    var yBottomRight = (yBottomRight / 100) * slideHeight;

    return {
        xTop,
        yTop,
        xBottomLeft,
        yBottomLeft,
        xBottomRight,
        yBottomRight
    };
}

const getEllipseCoordinates = (points, slideWidth, slideHeight) => {
    // x1 and y1 - coordinates of the ellipse's top left corner
    // x2 and y2 - coordinates of the ellipse's bottom right corner
    const x1 = points[0];
    const y1 = points[1];
    const x2 = points[2];
    const y2 = points[3];

    // rx - horizontal radius
    // ry - vertical radius
    // cx and cy - coordinates of the ellipse's center
    let rx = x2 - x1;
    let ry = y2 - y1;
    const cx = (x1 < x2) ? (x1 * slideWidth) / 100 : (x2 * slideWidth) / 100 ;
    const cy = (y1 < y2) ? (y1 * slideHeight) / 100 : (y2 * slideHeight) / 100;
    rx = Math.abs((rx / 100) * slideWidth);
    ry = Math.abs((ry / 100) * slideHeight);

    return {
        cx,
        cy,
        rx,
        ry
    };
}


const drawShape = (canvas, context, type, annotationInfo, slideWidth, slideHeight) => {
    context.globalCompositeOperation="source-over";
    const { points, commands } = annotationInfo;
    let i;
    let j;
    switch (type) {
        case "ellipse":
            var oval = getEllipseCoordinates(annotationInfo.points, slideWidth, slideHeight);
            var kappa = .5522848,
                ox = (oval.rx / 2) * kappa, // control point offset horizontal
                oy = (oval.ry / 2) * kappa, // control point offset vertical
                xe = oval.cx + oval.rx,           // x-end
                ye = oval.cy + oval.ry,           // y-end
                xm = oval.cx + oval.rx / 2,       // x-middle
                ym = oval.cy + oval.ry / 2;       // y-middle

            context.beginPath();
            context.moveTo(oval.cx, ym);
            context.bezierCurveTo(oval.cx, ym - oy, xm - ox, oval.cy, xm, oval.cy);
            context.bezierCurveTo(xm + ox, oval.cy, xe, ym - oy, xe, ym);
            context.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
            context.bezierCurveTo(xm - ox, ye, oval.cx, ym + oy, oval.cx, ym);
            context.lineWidth = getStrokeWidth(annotationInfo.thickness, slideWidth);
            // set line color
            context.strokeStyle = getFormattedColor(annotationInfo.color);
            context.stroke();
            break;
        case "line":
            var line = getLineCoordinates(annotationInfo.points, slideWidth, slideHeight);
            context.beginPath();
            context.moveTo(line.x1, line.y1);
            context.lineTo(line.x2, line.y2);
            context.closePath();
            context.lineWidth = getStrokeWidth(annotationInfo.thickness, slideWidth);
            // set line color
            context.strokeStyle = getFormattedColor(annotationInfo.color);
            context.stroke();
            break;
        case "triangle":
            var triangle = getTriangleCoordinates(annotationInfo.points, slideWidth, slideHeight);
            context.beginPath();
            context.moveTo(triangle.xTop, triangle.yTop);
            context.lineTo(triangle.xBottomLeft, triangle.yBottomLeft);
            context.lineTo(triangle.xBottomRight, triangle.yBottomRight);
            context.closePath();
            context.lineWidth = getStrokeWidth(annotationInfo.thickness, slideWidth);
            // set line color
            context.strokeStyle = getFormattedColor(annotationInfo.color);
            context.stroke();
            break;
        case "rectangle":
            context.beginPath();
            context.moveTo((annotationInfo.points[0] / 100) * slideWidth, (annotationInfo.points[1] / 100) * slideHeight);
            context.lineTo((annotationInfo.points[2] / 100) * slideWidth, (annotationInfo.points[1] / 100) * slideHeight);
            context.lineTo((annotationInfo.points[2] / 100) * slideWidth, (annotationInfo.points[3] / 100) * slideHeight);
            context.lineTo((annotationInfo.points[0] / 100) * slideWidth, (annotationInfo.points[3] / 100) * slideHeight);
            context.closePath();
            context.lineWidth = getStrokeWidth(annotationInfo.thickness, slideWidth);
            // set line color
            context.strokeStyle = getFormattedColor(annotationInfo.color);
            context.stroke();
            break;
        case "pencil":
            context.beginPath();
            context.moveTo((points[0] / 100) * slideWidth, (points[1] / 100) * slideHeight);

            if(annotationInfo.status !== DRAW_END) {
                i = 2;
                if (points && points.length >= 2) {
                    while (i < points.length) {
                        context.lineTo((points[i] / 100) * slideWidth, (points[i + 1] / 100) * slideHeight);
                        i += 2;
                    }
                }
            } else {
                for (i = 0, j = 0; i < commands.length; i += 1) {
                    switch (commands[i]) {
                        // MOVE_TO - consumes 1 pair of values
                        case 1:
                            context.moveTo((points[j] / 100) * slideWidth, (points[j + 1] / 100) * slideHeight);
                            j += 2;
                            break;
            
                        // LINE_TO - consumes 1 pair of values
                        case 2:
                            context.lineTo((points[j] / 100) * slideWidth, (points[j + 1] / 100) * slideHeight);
                            j += 2;
                            break;
            
                        // QUADRATIC_CURVE_TO - consumes 2 pairs of values
                        // 1st pair is a control point, second is a coordinate
                        case 3:
                            context.quadraticCurveTo((points[j] / 100) * slideWidth, (points[j + 1] / 100) * slideHeight, (points[j + 2] / 100) * slideWidth, (points[j + 3] / 100) * slideHeight);
                            j += 4;
                            break;
            
                        // CUBIC_CURVE_TO - consumes 3 pairs of values
                        // 1st and 2nd are control points, 3rd is an end coordinate
                        case 4:
                            context.bezierCurveTo((points[j] / 100) * slideWidth, 
                                (points[j + 1] / 100) * slideHeight, (points[j + 2] / 100) * slideWidth, 
                                (points[j + 3] / 100) * slideHeight, (points[j + 4] / 100) * slideWidth, 
                                (points[j + 5] / 100) * slideHeight);
                            j += 6;
                            break;
            
                        default:
                            break;
                    }
                }
            }
            context.lineWidth = getStrokeWidth(annotationInfo.thickness, slideWidth);
            // set line color
            context.strokeStyle = getFormattedColor(annotationInfo.color);
            context.stroke();
            break;
        case "eraser":
            context.beginPath();
            context.globalCompositeOperation="destination-out";
            i = 0;
            if (points && points.length >= 2) {
                while (i < points.length) {
                    context.arc((points[i] / 100) * slideWidth, (points[i + 1] / 100) * slideHeight, getStrokeWidth(annotationInfo.thickness, slideWidth), 0, Math.PI*2, false);
                    i += 2;
                }
            }
            context.lineWidth = getStrokeWidth(annotationInfo.thickness, slideWidth);
            // set line color
            context.strokeStyle = getFormattedColor(annotationInfo.color);
            context.stroke();
            // context.fill();
            break;
        case "text":
          context.fillStyle =  getFormattedColor(annotationInfo.fontColor);
          context.font =  annotationInfo.fontSize + 'px ' + 'Arial, sans-serif';
          context.textBaseline = "hanging";
          var textX = (annotationInfo.x / 100.0) * slideWidth,
            textY = (annotationInfo.y / 100.0) * slideHeight;
          var lineHeight = annotationInfo.fontSize;
          var lines = annotationInfo.text.split('\n');
          for (i = 0; i < lines.length; i ++)
            context.fillText(lines[i], textX, textY + (i * lineHeight));
          break;
        default:
            break;
    }
}

const isDeletedAnnotation = (annotationEraser, annotation, slideWidth, slideHeight) => {
  var eraserPoints = annotationEraser.annotationInfo.points;
  switch (annotation.annotationType) {
    case "line":
      var linePoints = annotation.annotationInfo.points;
      var lineDistance = getDistance(linePoints[0], linePoints[1], linePoints[2], linePoints[3]);
      var firstEraserDistance = getDistance(linePoints[0], linePoints[1], eraserPoints[0], eraserPoints[1]);
      var secondEraserDistance = getDistance(eraserPoints[0], eraserPoints[1], linePoints[2], linePoints[3]);
      if(lineDistance + annotation.annotationInfo.thickness > firstEraserDistance + secondEraserDistance)
        return 0;
      break;
    case "ellipse":
      var ellispePoints = annotation.annotationInfo.points,
        thickness = annotation.annotationInfo.thickness;
      var ellispePointsCopy = [Math.min(ellispePoints[0], ellispePoints[2]), Math.min(ellispePoints[1], ellispePoints[3]), Math.max(ellispePoints[0], ellispePoints[2]),Math.max(ellispePoints[1], ellispePoints[3])];

      var ellipseOuterPoints = [ellispePointsCopy[0]-thickness, ellispePointsCopy[1]-thickness, ellispePointsCopy[2]+thickness, ellispePointsCopy[3]+thickness],ellipseInnerPoints = [ellispePointsCopy[0]+thickness, ellispePointsCopy[1]+thickness, ellispePointsCopy[2]-thickness, ellispePointsCopy[3]-thickness];

      if(isEllipsePoint(ellipseOuterPoints, eraserPoints) && !isEllipsePoint(ellipseInnerPoints, eraserPoints))
        return 0;
      break; 
    case "triangle":
      var trianglePoints = annotation.annotationInfo.points,
        thickness = annotation.annotationInfo.thickness;
      var secondDotX = (trianglePoints[0] < trianglePoints[2]) ? trianglePoints[0] + Math.abs(trianglePoints[0] - trianglePoints[2]) / 2 : trianglePoints[2] + Math.abs(trianglePoints[0] - trianglePoints[2]) / 2;
      var firstLine = [trianglePoints[0], trianglePoints[3], trianglePoints[2], trianglePoints[3]],
        secondLine = [secondDotX, trianglePoints[1], trianglePoints[0], trianglePoints[3]],
        trirdLine = [secondDotX, trianglePoints[1], trianglePoints[2], trianglePoints[3]];
      if(isLinePoint(firstLine, eraserPoints, thickness) || isLinePoint(secondLine, eraserPoints, thickness) || isLinePoint(trirdLine, eraserPoints, thickness))
        return 0;
      break;
    case "rectangle":
      var rectPoints = annotation.annotationInfo.points,
        thickness = annotation.annotationInfo.thickness;

      var rectPointsCopy = [Math.min(rectPoints[0], rectPoints[2]), Math.min(rectPoints[1], rectPoints[3]), Math.max(rectPoints[0], rectPoints[2]),Math.max(rectPoints[1], rectPoints[3])];
      var rectOuterPoints = [rectPointsCopy[0]-thickness, rectPointsCopy[1]-thickness, rectPointsCopy[2]+thickness, rectPointsCopy[3]+thickness],rectInnerPoints = [rectPointsCopy[0]+thickness, rectPointsCopy[1]+thickness, rectPointsCopy[2]-thickness, rectPointsCopy[3]-thickness];

      if(isRectPoint(rectOuterPoints, eraserPoints) && !isRectPoint(rectInnerPoints, eraserPoints))
        return 0;
      break;
    case "pencil":
      if(annotation.annotationInfo.status == 'DRAW_START')
        break;
      var pencilPoints = annotation.annotationInfo.points,
        pencilCommands = annotation.annotationInfo.commands,
        thickness = annotation.annotationInfo.thickness;
      for(let i = 0, j = 0; i < pencilCommands.length; i += 1) {
        switch(pencilCommands[i]) {
          case 1:
            j += 2;
            break;
          case 2:
            var linePoints = [pencilPoints[j - 2], pencilPoints[j - 1], pencilPoints[j], pencilPoints[j + 1]];
            if(isLinePoint(linePoints, eraserPoints, thickness))
              return 0;
            j += 2;
            break;
          case 3:
            var quadraticPoints = [pencilPoints[j - 2], pencilPoints[j - 1], pencilPoints[j], pencilPoints[j + 1], pencilPoints[j + 2], pencilPoints[j + 3]]
            if(isQuadraticPoint(beizerPoints, eraserPoints, thickness))
              return 0;
            j += 4;
            break;
          case 4:
            var beizerPoints = [pencilPoints[j - 2], pencilPoints[j - 1], pencilPoints[j], pencilPoints[j + 1], pencilPoints[j + 2], pencilPoints[j + 3], pencilPoints[j + 4], pencilPoints[j + 5]]
            if(isBezierPoint(beizerPoints, eraserPoints, thickness))
              return 0;
            j += 6;
            break;
        }
      }
      break;  
    case "text":
      var textRect = [annotation.annotationInfo.x, annotation.annotationInfo.y, annotation.annotationInfo.x + annotation.annotationInfo.textBoxWidth, annotation.annotationInfo.y + annotation.annotationInfo.textBoxHeight];
      if(isRectPoint(textRect, eraserPoints))
        return 0;
      break;
  }
  return 1;
}

getDistance = (x1, y1, x2, y2) => {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

isLinePoint = (linePoints, eraserPoints, thickness) => {
  var lineDistance = getDistance(linePoints[0], linePoints[1], linePoints[2], linePoints[3]);
  var firstEraserDistance = getDistance(linePoints[0], linePoints[1], eraserPoints[0], eraserPoints[1]);
  var secondEraserDistance = getDistance(eraserPoints[0], eraserPoints[1], linePoints[2], linePoints[3]);
  if(lineDistance + thickness > firstEraserDistance + secondEraserDistance)
    return 1;
  return 0;
}

isEllipsePoint = (ellipsePoints, point) => {
  var a = Math.abs(ellipsePoints[2] - ellipsePoints[0]) / 2,
    b = Math.abs(ellipsePoints[3] - ellipsePoints[1]) / 2,
    h = (ellipsePoints[0] < ellipsePoints[2]) ? ellipsePoints[0] + a : ellipsePoints[2] + a,
    k = (ellipsePoints[1] < ellipsePoints[3]) ? ellipsePoints[1] + b : ellipsePoints[3] + b;
  var p = (Math.pow((point[0] - h), 2) / Math.pow(a, 2)) 
  + (Math.pow((point[1] - k), 2) / Math.pow(b, 2));
  return p <= 1;
}

isRectPoint = (rectPoint, point) => {
  if(rectPoint[0] <= point[0] &&  point[0] <= rectPoint[2] && rectPoint[1] <= point[1] && point[1] <= rectPoint[3])
    return 1;
  return 0;
}

isBezierPoint = (points, eraserPoints, thickness) => {
  var t = 0;
  while(t < 1) {
    bezierXY = getBezierXY(t, points[0], points[1], points[2], points[3], points[4], points[5], points[6], points[7]);
    if (getDistance(eraserPoints[0], eraserPoints[1], bezierXY[0], bezierXY[1]) < thickness)
      return 1;
    t += 0.01;
  }
  return 0;
}

getBezierXY = (t, sx, sy, cp1x, cp1y, cp2x, cp2y, ex, ey) => {
  var x = Math.pow(1-t,3) * sx + 3 * t * Math.pow(1 - t, 2) * cp1x 
  + 3 * t * t * (1 - t) * cp2x + t * t * t * ex,
    y= Math.pow(1-t,3) * sy + 3 * t * Math.pow(1 - t, 2) * cp1y 
  + 3 * t * t * (1 - t) * cp2y + t * t * t * ey;
  return [x, y];
}

isQuadraticPoint = (points, eraserPoints, thickness) => {
  var t = 0;
  while(t < 1) {
    quadraticXY = getQuadraticXY(t, points[0], points[1], points[2], points[3], points[4], points[5]);
    if (getDistance(eraserPoints[0], eraserPoints[1], quadraticXY[0], quadraticXY[1]) < thickness)
      return 1;
    t += 0.01;
  }
  return 0;
}

getQuadraticXY = (t, sx, sy, cp1x, cp1y, ex, ey) => {
  var x = (1-t) * (1-t) * sx + 2 * (1-t) * t * cp1x + t * t * ex,
    y = (1-t) * (1-t) * sy + 2 * (1-t) * t * cp1y + t * t * ey;
  return [x, y];
}

export default {
    getFormattedColor,
    getStrokeWidth,
    drawShape,
    isDeletedAnnotation
};
