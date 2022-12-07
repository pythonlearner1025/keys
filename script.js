// loads
var canvas = document.getElementById("myCanvas");
var output = document.getElementById("output");
var resetZoom = document.getElementById("resetZoom");
var editMode = document.getElementById("editMode");
var {width, height} = canvas
var cBound = canvas.getBoundingClientRect()
setCanvasWidth();

// consts

const gxstart = xGS(0)
const gxspan= xGS(width) - xGS(0)
const gystart = yGS(0)
const gyspan = yGS(height) - yGS(0)
     
var origin = 0
var ctx = canvas.getContext("2d");
var graphxmin;
var graphymin;
var graphxmax;
var graphymax;

// states
var editing = false;
var allPoints = []

var pointSettings = {
    radius: 2.0,
    dx: 0,
    dy: 0,
    color: 'black',
    lineWidth: 0,
}
var mdown = false;
var dragStart = {
    x: 0,
    y: 0
}
var dragEnd = {
    x: 0,
    y: 0
}
var transform = {
    scalex: 1.0,
    scaley: 1.0,
    dx: 0,
    dy: 0, 
}

// world space
/*
    grid
    points

*/


// canvas space
/*

*/


function c2w(x,y) {
    // subtract initial starting point of canvas
    x = (x / transform.scalex) + transform.dx
    y = (y / transform.scaley) + transform.dy
    return {x:x, y:y}
}

function w2c(x,y) {
    // add initial starting point of canvas 
    x = (x - transform.dx) * transform.scalex
    y = (y - transform.dy) * transform.scaley
    return {x:x, y:y}
}


// class grid
class Grid{
    constructor() {
        this.cellsize = 20

        // center of grid
        this.cx = xGS(0) 
        this.cy = yGS(0) + (yGS(height)-yGS(0))/2
        this.cr = 2
        
        this.minY = yGS(0)
        this.maxY = yGS(height)
        this.minX = xGS(0)
        this.maxX = xGS(width)
        this.dx = 0 
        this.dy= 0

        this.zx = xGS(0)
        this.zy = yGS(0) + (yGS(height)-yGS(0))/2
    }
    
    // do all transform outside of draw
    draw2() {
        
        // transform
        const ccx = this.cx + this.dx 
        const ccy = this.cy + this.dy 
        // draw center

        ctx.beginPath()
        ctx.arc(ccx, ccy, this.cr, 0, 2 * Math.PI, false)
        ctx.fillStyle = 'red'
        ctx.fill()
        ctx.closePath() 

                                    // watch the y
        for (let i=0; i<Math.max(this.maxY-ccy, ccy-this.minY); i+=this.cellsize) {
            var pos1 = ccy + i 
            var pos2 = ccy - i 
            if (this.minY <= pos1 && pos1 <= this.maxY){
                ctx.beginPath()
                ctx.moveTo(this.minX, pos1)
                ctx.lineTo(this.maxX, pos1)
                ctx.stroke()
                ctx.closePath() 
            }
            if (this.minY <= pos2 && pos2 <= this.maxY) {
                // up
                ctx.beginPath()
                ctx.moveTo(this.minX, pos2)
                ctx.lineTo(this.maxX, pos2)
                ctx.stroke()
                ctx.closePath()
            }
        }

        for (let i=0; i<Math.max(this.maxX-ccx, ccx-this.minX); i+=this.cellsize){
            var pos1 = ccx + i 
            var pos2 = ccx - i
            if (this.minX <= pos1 && pos1 <= this.maxX){
                ctx.beginPath()
                ctx.moveTo(pos1, this.minY)
                ctx.lineTo(pos1, this.maxY)
                ctx.stroke()
                ctx.closePath()
            } 
            if (this.minX <= pos2 && pos2 <= this.maxX){
                ctx.beginPath()
                ctx.moveTo(pos2, this.minY)
                ctx.lineTo(pos2, this.maxY)
                ctx.stroke()
                ctx.closePath()
            } 
        }
    }
   
}

class Point{
    constructor(x,y){
        // canvas coords
        this.x = x
        this.y = y
        this.dx = 0
        this.dy = 0
        this.r = pointSettings.radius
        this.color = pointSettings.color
        this.lineWidth = pointSettings.lineWidth
    }

    draw() {
        ctx.beginPath()
        ctx.arc(xGS(this.x)+  this.dx, yGS(this.y) + this.dy, this.r, 0, 2 * Math.PI, false)
        ctx.fillStyle = this.color
        ctx.fill()
        ctx.lineWidth = this.lineWidth
        ctx.stroke()
        ctx.closePath()
    }
}

const grid = new Grid()

// for now hardcode, later enable change
var xminDefault = 0;
var xmaxDefault = 100;
var yminDefault = -1;
var ymaxDefault = 2;
var xmin = xminDefault;
var xmax = xmaxDefault;
var ymin = yminDefault;
var ymax = ymaxDefault;

function setCanvasWidth() {
    canvas.setAttribute("width", canvas.parentNode.clientWidth * 0.9);
    canvas.setAttribute("height", canvas.width / 2);
    width = canvas.width;
    height = canvas.height;
    graphxmin = 30;
    graphymin = 10;
    graphxmax = width - 10;
    graphymax = height - 30;
}

function resetCanvas(){
    ctx.clearRect(0, 0, width, height);
    //drawUI();
}


// events
window.addEventListener("resize", function (e) {
    setCanvasWidth();
    resetCanvas();
  });

window.addEventListener("wheel", function(e) {
    const x = parseInt(e.pageX);
    const y = parseInt(e.pageY); 
    // in screen space
    if (inG(x-cBound.x, y-cBound.y)) {
        zoom(x-cBound.x, y-cBound.y, e.deltaY)
    } 
})

window.addEventListener('mousemove', function (e) {  
    e.preventDefault();
    e.stopPropagation();
    const x = parseInt(e.pageX);
    const y = parseInt(e.pageY); 
    if (mdown && inG(x-cBound.x,y-cBound.y)) {
        drag(x - dragStart.x, y - dragStart.y)
        dragStart.x = x
        dragStart.y = y
    }
})

window.addEventListener('mousedown', function (e) {  
    e.preventDefault();
    e.stopPropagation();
    mdown = true;
    x = parseInt(e.pageX);
    y = parseInt(e.pageY);
    dragStart.x = x
    dragStart.y = y
    if (inG(x-cBound.x, y-cBound.y) && editing) {
        console.log('mousedown')
        console.log(x,y)
        addPoint(x-cBound.x, y-cBound.y)
    }
})

window.addEventListener('mouseup', function (e) {  
    e.preventDefault();
    e.stopPropagation();
    mdown = false; 
    dragEnd.x = parseInt(e.pageX);
    dragEnd.y = parseInt(e.pageY);
    if (dragEnd.x - dragStart.x != 0 || dragEnd.y - dragStart.y != 0) {
        //updatePos(dragEnd.x - dragStart.x, dragEnd.y - dragStart.y)
    }
})

function updatePos(x,y) {
    console.log(x,y)
    transform.dx = x
    transform.dy = y
}


const labelPos = {
    x: xGS(10),
    y: yGS(30),
  };


function drag(dx,dy) {
    grid.cx += dx
    grid.cy += dy
    allPoints.forEach((point) => {
        point.dx += dx
        point.dy += dy
    })
}


//TODO
// scales fucked up, fix with clear mind

const r = 1.05
// if zoom in box, redraw everything to scale 
function zoom(x,y, scale) {
    if (scale >= 0) {
        scale = r
    } else {
        scale = 2 - r 
    }

    pointSettings.radius *= scale
    var s = scale
    var c = grid.cellsize
    var cx = grid.cx
    var cy = grid.cy
    var nx = (x-cx)/c >= 0 ? Math.floor((x-cx)/c) : Math.ceil((x-cx)/c)
    var ny = (cy-y)/c >= 0 ? Math.floor((cy-y)/c) : Math.ceil((cy-y)/c)
    var leftx = ((x-cx)/c) - nx
    var lefty = ((cy-y)/c) - ny
    var x1x = leftx * s * c
    var x1y = lefty * s * c
    var x0x = leftx * c
    var x0y = lefty * c
    var px = nx*(c*s-c)
    var py = ny*(c*s-c)
    var vx = px + x1x-x0x
    var vy = py + x1y-x0y
    grid.cx -= vx
    grid.cy += vy
    grid.cellsize *= s
}

function addPoint(x,y) {
    allPoints.push(new Point(xSG(x),ySG(y)))
}

// helpers
function xGS(xIn) {
    return transformCoord(xIn, graphxmin, graphxmax, 0, width);
}

function yGS(yIn) {
    return transformCoord(yIn, graphymin, graphymax, 0, height);
}

function xSG(xIn) {
    return transformCoord(xIn, 0, width, graphxmin, graphxmax);
  }
  
function ySG(yIn) {
    return transformCoord(yIn, 0, height, graphymin, graphymax);
}

function transformCoord(coordIn, minIn, maxIn, minOut, maxOut) {
    let progression = (coordIn - minOut) / (maxOut - minOut);
    let coordOut = progression * (maxIn - minIn) + minIn;
    return coordOut;
}

function inG(x,y){
    if ((gxstart < x && x < gxstart + gxspan) && (gystart < y && y < gystart + gyspan)) {
        return true
    } else return false
}

// draw funcs
function drawUI() {
    ctx.save()
    ctx.beginPath()
    ctx.rect(
        xGS(0),
        yGS(0),
        xGS(width) - xGS(0),
        yGS(height) - yGS(0)
      );
    ctx.stroke()
    ctx.closePath()
    ctx.restore()
    

    // x axis
    var ymid = yGS(0) + (yGS(height) - yGS(0))/2
    var xmid = xGS(0) + (xGS(width) - xGS(0))/2 
    ctx.strokeStyle = '#A9A9A9'
    ctx.beginPath()
    ctx.moveTo(xGS(0), ymid)
    ctx.lineTo(xGS(width), ymid)
    ctx.stroke()
    ctx.restore()
    ctx.closePath()

    // labels
    ctx.font = "10px serif"
    ctx.fillText("x", xmid, yGS(0)+yGS(height))
    ctx.fillText("y", xGS(0)-10, ymid)
  
}
function drawGrid() {
    grid.draw2(
    )
}

function drawPoints() {
    allPoints.forEach((point) => {
        // TODO
        // draw if inside canvas
        point.r = pointSettings.radius 
        point.draw()
    })
}

// draw all
requestAnimationFrame(function draw() {
    ctx.clearRect(0,0,width, height)
    drawUI()
    drawGrid()
    drawPoints()
    requestAnimationFrame(draw)
})


// callbacks

resetZoom.addEventListener("click", () => {
    gridSettings.cellSize = cellsize
})

editMode.addEventListener("click", () => {
    editing = !editing;
})