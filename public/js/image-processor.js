
window.onerror = function() {
    location.reload();
}

const video = document.getElementById('videoInput')
const button = document.getElementById('videoStarter')

var goodToUpload = false

Promise.all([
    faceapi.nets.faceRecognitionNet.loadFromUri('./models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
    faceapi.nets.ssdMobilenetv1.loadFromUri('./models') //heavier/accurate version of tiny face detector
]).then(start);

$('#myform').on('submit', ()=> {
    if($('#image').val() == '') return false
    if(goodToUpload){
        goodToUpload = false
        return true
    }
    console.log('SAMPLE')
    makeImageDescription()
    return false
})

async function makeImageDescription(){

    var img = document.getElementById('output')
    var name = document.getElementById('name').value

    document.getElementById("myform").action = "/upload?crim=" + name

    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor()
    const descriptor = await detection.descriptor

    await fetch("/upload-descriptor", {
        method: "POST",
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            descriptor: descriptor,
            name: name
        })
    }).then((response) => response.json())
    .then((data) => {
        if(data.message == 'RECEIVED'){
            console.log('here')
            goodToUpload = true
            $('#myform').submit()
        }
        console.log('oops here')
    })
}

function start() {
    var currentLocation = window.location.href;
    if(findWord("dashboard", currentLocation)){

        console.log('Models added')
        
        navigator.getUserMedia(
            { video:{} },
            stream => video.srcObject = stream,
            err => console.error(err)
        )

            console.log('video added')
            //recognizeFaces()
    }
}
function findWord(word, str) {
    return str.split('/').some(function(w){return w === word})
}
async function recognizeFaces() {

    const labeledDescriptors = await loadLabeledImages()
    console.log(labeledDescriptors)
    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.7)


    //pag ma play
    button.addEventListener('click', async() => {
        console.log('Playing')
        const canvas = faceapi.createCanvasFromMedia(video)
        document.getElementById('container').append(canvas)

        const displaySize = { width: video.width, height: video.height }
        faceapi.matchDimensions(canvas, displaySize)

        const detections = await faceapi.detectAllFaces(video).withFaceLandmarks().withFaceDescriptors()

        const resizedDetections = faceapi.resizeResults(detections, displaySize)

        const results = resizedDetections.map((d) => {
            console.log(faceMatcher.findBestMatch(d.descriptor).toString())
            return faceMatcher.findBestMatch(d.descriptor)
        })
    })
}