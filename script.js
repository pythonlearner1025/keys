var canvas = document.getElementById("myCanvas");
var output = document.getElementById("output");
var resetZoom = document.getElementById("resetZoom");
var editMode = document.getElementById("editMode");
var audioFile = document.getElementById("audioFile");
var play = document.getElementById("play");
// vals
var sendfunc = document.getElementById("sendfunc")
var gotfunc = document.getElementById("func");
var sendfps = document.getElementById("sendfps")
var gotfps = document.getElementById("fps")
var sendsecs = document.getElementById("sendsecs")
var gotsecs = document.getElementById("secs")
var clear = document.getElementById("clearcanvas")


var {width, height} = canvas
var cBound = canvas.getBoundingClientRect()
var audioCtx = new (AudioContext || webkitAudioContext)();
setCanvasWidth();



var gxstart = xGS(0)
var gxspan= xGS(width) - xGS(0)
var gystart = yGS(0)
var gyspan = yGS(height) - yGS(0)
     
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
var ePoints = new Set()
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
        
        this.dx = 0 
        this.dy= 0

        this.zx = xGS(0)
        this.zy = yGS(0) + (yGS(height)-yGS(0))/2
    }
    
    // do all transform outside of draw
    draw() {
        // transform
        const minY = gystart 
        const maxY = gystart + gyspan
        const minX = gxstart
        const maxX = gxstart + gxspan
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
        for (let i=0; i<Math.max(maxY-ccy, ccy-minY); i+=this.cellsize) {
            var pos1 = ccy + i 
            var pos2 = ccy - i 
            if (minY <= pos1 && pos1 <= maxY){
                ctx.beginPath()
                ctx.moveTo(minX, pos1)
                ctx.lineTo(maxX, pos1)
                ctx.stroke()
                ctx.closePath() 
            }
            if (minY <= pos2 && pos2 <= maxY) {
                // up
                ctx.beginPath()
                ctx.moveTo(minX, pos2)
                ctx.lineTo(maxX, pos2)
                ctx.stroke()
                ctx.closePath()
            }
        }

        for (let i=0; i<Math.max(maxX-ccx, ccx-minX); i+=this.cellsize){
            var pos1 = ccx + i 
            var pos2 = ccx - i
            if (minX <= pos1 && pos1 <= maxX){
                ctx.beginPath()
                ctx.moveTo(pos1, minY)
                ctx.lineTo(pos1, maxY)
                ctx.stroke()
                ctx.closePath()
            } 
            if (minX <= pos2 && pos2 <= maxX){
                ctx.beginPath()
                ctx.moveTo(pos2, minY)
                ctx.lineTo(pos2, maxY)
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
        this.frame = 0
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
    gxstart = xGS(0)
    gxspan= xGS(width) - xGS(0)
    gystart = yGS(0)
    gyspan = yGS(height) - yGS(0)
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
    e.stopPropagation();
    mdown = true;
    x = parseInt(e.pageX);
    y = parseInt(e.pageY);
    dragStart.x = x
    dragStart.y = y
    if (inG(x-cBound.x, y-cBound.y) && editing) {
        const dx = x -cBound.x - grid.cx 
        const dy = y -cBound.y - grid.cy
        const wx = dx / grid.cellsize
        const wy = dy / grid.cellsize
        addPoint(dx,dy,wx,wy,false,true)
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

function addPoint(dx,dy,wx,wy,line,label,frame=0) {
   var p = new Point(dx,dy,wx,wy)
   p.labels = label
   if (frame) {
       p.frame = frame
   }
   if (line && allPoints.length > 0) {
        var pb = allPoints[allPoints.length-1]
        allLines.push(new Line(pb, p))
   } 
   allPoints.push(p)
   ePoints.add(p)
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

console.log(cBound, width, height)
function drawMask() {
    // top left corner
    // 0,0

    // bottom right corner
    // xGS(0)+gxspan, yGS(0)+gyspan

    // graph top left corner
    // xGS(0), yGS(0)/

    // graph bottom right corner
    // xGS(0)+gxspan, yGS(0)+gyspan

    // top rect
    ctx.clearRect(0,0,width,yGS(0))
    // left rect
    ctx.clearRect(0,0,xGS(0),height)
    // right rect
    ctx.clearRect(xGS(0)+gxspan,0,width-xGS(0)-gxspan,height)
    // bottom rect
    ctx.clearRect(0,yGS(0)+gyspan,width,height-yGS(0)-gyspan)
}

function drawPoints() {
    allPoints.forEach((point) => {
        point.draw()
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
        // if point still exists
        if (ePoints.has(line.a) && ePoints.has(line.b)){
            line.draw()
        }
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
    drawMask()
    requestAnimationFrame(draw)
})


// callbacks

resetZoom.addEventListener("click", () => {
    // TODO
    grid.cellsize =20
})

editMode.addEventListener("click", () => {
    editing = !editing;
})

clear.addEventListener("click", () => {
    allPoints = []
    allLines = []
})

var setfunc;
sendfunc.addEventListener("click", () => {
    setfunc = gotfunc.value
    graph(setfunc)
})

var setfps = fps;
sendfps.addEventListener("click", () => {
    setfps = gotfps.value
    var txt = `set fps: ${setfps}`
    document.getElementById("deffps").innerHTML=txt
})

var setsecs = s;
sendsecs.addEventListener("click", () => {
    setsecs = gotsecs.value
    var txt = `set secs: ${setsecs}`
    document.getElementById("defsecs").innerText=txt
})

function graph(exp) {
    var dx = grid.cellsize / setfps
    for (let i=0; i<setfps*setsecs; i++) {
        var x = i * dx
        var f = exp.replaceAll('t', i)
        var y = math.evaluate(f)*grid.cellsize
        addPoint(x,-y,x/grid.cellsize,-y/grid.cellsize,true,false, frame=i)
    }
}


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
    var duration = buff.duration
    var hz = buff.sampleRate
    var ch1 = buff.getChannelData(0)

    var sampled = []
    for (let i=0; i<Math.floor(hz/fps)*fps*duration; i+=Math.floor(hz/fps)) {
        sampled.push(ch1[i])
    }

    // add points
    for (let i=0; i<duration*fps; i++) {
        var x = (i+1) / fps
        var y = sampled[i] * 5
        var dx = x * grid.cellsize
        var dy = y * grid.cellsize
        var wx = x 
        var wy = y
        addPoint(dx,dy,wx,wy,true,false,frame=i)
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
var convert = document.getElementById("convert")
var output = document.getElementById("output")

output.addEventListener("click", () => {
    document.getElementById("output").select()
    document.execCommand("copy")

})

convert.addEventListener("click", () => {
    var res = w2f()
    output.value = res 
})

// convert all points to output frame string
function w2f() {
    allPoints.sort(function(a,b) {
        if (a.dx < b.dx) return -1
        if (a.dx > b.dx) return 1
        return 0
    })
    var result = ''
    for (let i=0; i<allPoints.length; i++){
        var p = allPoints[i]
        var str = `${p.frame}:(${p.ody.toFixed(2)})`
        result += str
        if (i != allPoints.length - 1) result += ','
    }
    return result
}


document.addEventListener("keydown", (e) => {
    var id = e.key
    if (id == 'Backspace' && editing) {
        var deadp = allPoints.pop()
        ePoints.delete(deadp)
    }
})

