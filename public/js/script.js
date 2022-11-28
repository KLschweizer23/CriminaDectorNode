
window.onerror = function() {
    location.reload();
}
const video = document.getElementById('videoInput')
const button = document.getElementById('videoStarter')

Promise.all([
    faceapi.nets.faceRecognitionNet.loadFromUri('./models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
    faceapi.nets.ssdMobilenetv1.loadFromUri('./models') //heavier/accurate version of tiny face detector
]).then(start);

function start() {
    var currentLocation = window.location.href;
    if(findWord("dashboard", currentLocation)){

        document.body.append('Models Loaded')
        
        navigator.getUserMedia(
            { video:{} },
            stream => video.srcObject = stream,
            err => console.error(err)
        )
            
            console.log('video added')
            recognizeFaces()
    }
}
function findWord(word, str) {
    return str.split('/').some(function(w){return w === word})
}
$('#myform').on('submit', ()=> {
    if($('#image').val() == '') return false
    
    var name = document.getElementById('name').value

    document.getElementById("myform").action = "/upload?crim=" + name
    return true
})
async function recognizeFaces() {

    const labeledDescriptors = await loadLabeledImages()
    if(labeledDescriptors == null){
        alert('No Criminals added to the database!')
        return
    }
    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.51)


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
        //displayResults(results)
    })
    // video.addEventListener('play', async () => {
    // })
}
function displayResults(results){
    results.forEach( (result, i) => {
        console.log(result.toString())
    })
}
//load images
async function loadLabeledImages() {
    const criminals = await $.get('/get-all-criminals', async (data) => {
        console.log(await data)
        return data;
    })
    if(criminals.length == 0)
        return null
    
    return Promise.all(
        criminals.map(async (criminal)=>{
            const descriptions = []
            for(let i=1; i<=criminal['picSize']; i++) {
                const img = await faceapi.fetchImage(`../criminals/${criminal.name}/${i}.jpg`)
                const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor()
                descriptions.push(detections.descriptor)
            }
            return new faceapi.LabeledFaceDescriptors(criminal.name, descriptions)
        })
    )
}