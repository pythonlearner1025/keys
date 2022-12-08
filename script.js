// loads
var canvas = document.getElementById("myCanvas");
var output = document.getElementById("output");
var resetZoom = document.getElementById("resetZoom");
var editMode = document.getElementById("editMode");
var audioFile = document.getElementById("audioFile");
var play = document.getElementById("play");
var {width, height} = canvas
var cBound = canvas.getBoundingClientRect()
var audioCtx = new (AudioContext || webkitAudioContext)();
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

// audio settings
// TODO: these should be changeable
const fps = 24
const s = 250

var drawBar = false

var playableBuff;
var source;

var editing = false;
var allPoints = []
var allLines = []

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

class Line{
    constructor(a,b) {
        this.a = a
        this.b = b
    }

    draw() {
        var x1 = grid.cx + this.a.dx
        var y1 = grid.cy + this.a.dy
        var x2 = grid.cx + this.b.dx
        var y2 = grid.cy + this.b.dy
        // don't draw if both are out

        if (!inG(x1,y1) && !inG(x2,y2)) {
            if ((x1 <= gxstart && y2 <= gystart) || (x2 <= gxstart && y1 <= gystart)) {
                var g = (y2-y1)/(x2-x1)
                var nx1 = gxstart
                var ny1 = y1 + g*(gxstart-x1) 
                var nx2 = x1 + 1/g*(gystart-y1) 
                var ny2 = gystart
                x1 = nx1
                x2 = nx2
                y1 = ny1
                y2 = ny2
            }

        } else if (!inG(x1,y1)) {
            var dx = x2 - x1
            var dy = y2 - y1
            var g = dy/dx
            // bug
            if (x1 <= gxstart) {
                var vx = x2 - gxstart
                var vy = vx * g
                x1 = gxstart 
                y1 = y2 - vy
            // bug
            } else if (x1 >= gxstart + gxspan) {
                var vx = x2 - (gxstart + gxspan)
                var vy = vx * g
                x1 = gxstart + gxspan 
                y1 = y2 - vy
            } else if (y1 <= gystart) {
                var vy = y2 - gystart 
                var vx = -vy * 1/g
                x1 = x2 + vx
                y1 = gystart 
            } else if (y1 >= gystart + gyspan) {
                var vy = y2 - (gystart + gyspan)
                var vx = -vy * 1/g
                x1 = x2 + vx
                y1 = gystart + gyspan   
            }
        } else if (!inG(x2,y2)) {
            var dx = x1 - x2
            var dy = y1 - y2
            var g = dy/dx
            // left
            if (x2 <= gxstart) {
                var vx = x1 - gxstart
                var vy = vx * g
                x2 = gxstart 
                y2 = y1 - vy
            } else if (x2 >= gxstart + gxspan) {
                var vx = x1 - (gxstart + gxspan)
                var vy = vx * g
                x2 = gxstart + gxspan  
                y2 = y1 - vy
            } else if (y2 <= gystart) {
                var vy = y1 - gystart 
                var vx = -vy * 1/g
                x2 = x1 + vx
                y2 = gystart 
            } else if (y2 >= gystart + gyspan) {
                var vy = y1 - (gystart + gyspan)
                var vx = -vy * 1/g
                x2 = x1 + vx
                y2 = gystart + gyspan 
            }
        }

        ctx.beginPath()
        ctx.moveTo(x1,y1)
        ctx.lineTo(x2,y2)
        ctx.stroke()
        ctx.closePath()
    }
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
    draw() {
        
        // transform
        const ccx = this.cx + this.dx 
        const ccy = this.cy + this.dy 
        // draw center
        if (inG(ccx,ccy)) {
            ctx.beginPath()
            ctx.arc(ccx, ccy, this.cr, 0, 2 * Math.PI, false)
            ctx.fillStyle = 'red'
            ctx.fill()
            ctx.closePath() 
        }
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
    constructor(dx,dy, wx, wy){
        // offset from center of grid
        this.odx = wx 
        this.ody = wy 
        this.dx = dx 
        this.dy = dy 
        this.r = pointSettings.radius
        this.color = pointSettings.color
        this.lineWidth = pointSettings.lineWidth
        this.labels = true
    }

    draw() {
        // draw point
        ctx.beginPath()
        ctx.arc(grid.cx + this.dx, grid.cy + this.dy, this.r, 0, 2 * Math.PI, false)
        ctx.fillStyle = this.color
        ctx.fill()
        ctx.lineWidth = this.lineWidth
        ctx.stroke()
        ctx.closePath()
        if (!this.labels) {
            return
        }
        // draw labels
        var label = `(${this.odx.toFixed(2)}, ${-this.ody.toFixed(2)})`
        var labeldx = 4
        var labeldy = 9
        ctx.font = '8 serif'
        ctx.fillText(label, grid.cx + this.dx + labeldx, grid.cy + this.dy + labeldy)
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

    // grid
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
        // points
    allPoints.forEach((p) => {
        var x = cx + p.dx
        var y = cy + p.dy
        var nx = (x-cx)/c >= 0 ? Math.floor((x-cx)/c) : Math.ceil((x-cx)/c)
        var ny = (y-cy)/c >= 0 ? Math.floor((y-cy)/c) : Math.ceil((y-cy)/c)
        var px = nx * (c*s-c)
        var py = ny * (c*s-c)
        var leftx = ((x-cx)/c)-nx
        var lefty = ((y-cy)/c)-ny
        var x1x = leftx * s * c
        var x1y = lefty * s * c
        var x0x = leftx * c
        var x0y = lefty * c
        var fx = px + x1x - x0x
        var fy = py + x1y - x0y
        p.dx += fx
        p.dy += fy
    })

    grid.cx -= vx
    grid.cy += vy
    grid.cellsize *= s
}

function addPoint(x,y) {
    const dx = x - grid.cx
    const dy = y - grid.cy
    const wx = dx / grid.cellsize
    const wy = dy / grid.cellsize
    allPoints.push(new Point(dx,dy,wx,wy))
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
    grid.draw()
}

var once = true


function drawPoints() {
    // TEST    
    if (once && allPoints.length == 2) {
        var p1 = allPoints[0]
        var p2 = allPoints[1]
        allLines.push(new Line(p1, p2))
        once = false
    }

    allPoints.forEach((point) => {
        // TODO
        // draw if inside canvas
        if (inG(grid.cx + point.dx, grid.cy + point.dy)) {
            point.draw()
        }
    })
}

function drawMusicBar() {
    if (!drawBar) return 
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(gxstart + gxspan / 2, gystart)
    ctx.lineTo(gxstart + gxspan / 2, gystart + gyspan)
    ctx.strokeStyle = '#a0ff57'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.closePath()
    ctx.restore()
}

function drawLines() {
    ctx.save()
    ctx.lineWidth = 1
    ctx.strokeStyle = '#7e4ef5'
    allLines.forEach((line) => {
        line.draw()
    })
    ctx.restore()
}

// draw all
requestAnimationFrame(function draw() {
    ctx.clearRect(0,0,width, height)
    drawUI()
    drawGrid()
    drawPoints()
    drawLines()
    drawMusicBar()
    requestAnimationFrame(draw)
})


// callbacks

resetZoom.addEventListener("click", () => {
    gridSettings.cellSize = cellsize
})

editMode.addEventListener("click", () => {
    editing = !editing;
})


// TODO:
play.addEventListener("click", () => {

    if (!source) return
    // for now, only one channel
    source.connect(audioCtx.destination)
    source.start()

    // translate everything to center of canvas
    drawBar = true
    grid.cx = gxstart + gxspan /2  
    grid.cy = gystart + gyspan /2

    // start timer
    // begin translating
    var c = 0
    var inter = 10
    var tid = setInterval(() => {

        c+=inter

        var dx = grid.cellsize / (1000 / inter)
        grid.cx -= dx

        if (c >= playableBuff.duration * 1000) {
            source.stop()
            source.disconnect(audioCtx.destination)
            clearInterval(tid)
            drawBar = false
        }
    }, inter)
})


audioFile.addEventListener("input", (e) => {
    console.log(e.target.files)
    var files = e.target.files
    var reader = new FileReader()
    reader.onload = async (e)=> {
        console.log('here')
        buff = await audioCtx.decodeAudioData(e.target.result)
        processAudio(buff)
        console.log(buff)
    }
    reader.readAsArrayBuffer(files[0])
})

/*
struct of AudioBuffer 
duration
- 252.70414583333334
length
- 12129799
numberOfChannels
- 2
sampleRate
- 48000
*/


// let each grid be worth a second
// TODO: add different channels in different colors

function processAudio(buff) {
    // hertz = 48000
    //left
    var length = buff.length
    var hz = buff.sampleRate
    var ch1 = buff.getChannelData(0)

    var sampled = []
    for (let i=0; i<Math.floor(hz/fps)*fps*s; i+=Math.floor(hz/fps)) {
        sampled.push(ch1[i])
    }

    // add points
    var lastPoint;
    for (let i=0; i<s*fps; i++) {
        var x = (i+1) / fps
        var y = sampled[i] * 5
        var dx = x * grid.cellsize
        var dy = y * grid.cellsize
        var wx = x 
        var wy = y
        const p = new Point(dx,dy,wx,wy)
        p.labels = false
        allPoints.push(p)
        if (lastPoint) {
            allLines.push(new Line(lastPoint, p))
        }
        lastPoint = p
    }

    playableBuff = audioCtx.createBuffer(
        1,
        // length sample-frame... what is it? 
        length,
        hz,
    )
    const playBuffer = playableBuff.getChannelData(0);
    for (let i=0; i<length; i++) {
        playBuffer[i] = ch1[i]
    }
    source = audioCtx.createBufferSource();
    source.buffer = playableBuff

}





