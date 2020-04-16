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
            // const textbox = new fabric.IText('Tap and Type', { 
            //     fontFamily: 'arial black',
            //     left: Math.floor(annotationInfo.x / 100 * slideWidth), 
            //     top: Math.floor(annotationInfo.y / 100 * slideHeight) ,
            // });
            // canvas.add(textbox);
            break;
        default:
            break;
    }
}



export default {
    getFormattedColor,
    getStrokeWidth,
    drawShape
};
