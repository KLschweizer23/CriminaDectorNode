
window.onerror = function() {
    location.reload();
}
const video = document.getElementById('videoInput')
const button = document.getElementById('videoStarter')

$('#loadingModal').modal({ show: true });
Promise.all([
    faceapi.nets.faceRecognitionNet.loadFromUri('./models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
    faceapi.nets.ssdMobilenetv1.loadFromUri('./models') //heavier/accurate version of tiny face detector
]).then(start);

async function start() {
    $('#loadingModal').modal({ show: true });
    if(await checkIfLoadModels() ){        
        navigator.getUserMedia(
            { video:{} },
            stream => video.srcObject = stream,
            err => console.error(err)
        )
            
            console.log('video added')
            recognizeFaces()
    }
}

async function checkIfLoadModels(){
    var status = await $.get('/status', async (data) => {
        return await data;
    })
    console.log(status.status)
    if(!status.status){
        $('#loadingModal').modal('hide')
        $('#videoStarter').hide()
        $('#result').text('Enable automatic loading of models in the settings')
        $('#toggle-event').bootstrapToggle('off');
    }
    return status.status
}

async function editRow(id){

    const criminal = await $.get('/criminal-record?c_id=' + id, async (data) => {
        return await data
    })
    document.getElementById("myform_edit").action = "/upload?update=" + id
    $('#crim_name_edit').val(criminal.person.name)
    $('#crim_description_edit').val(criminal.description)
    $('#crim_lastSeen_edit').val(criminal.lastSeen)
    $('#editCriminalModal').modal({ show: true });
}

$('#toggle-event').change(function() {
    var status = document.getElementById('toggle-event').checked
    $.get('/status?value=' + status)
})
$('#myform').on('submit', ()=> {
    if($('#image').val() == '') return false
    
    var name = document.getElementById('crim_name').value
    var sex = document.getElementById('crim_sex').value
    var desc = document.getElementById('crim_description').value
    var lastSeen = document.getElementById('crim_lastSeen').value

    document.getElementById("myform").action = "/upload?crim_name=" + name + '&crim_sex=' + sex + '&crim_description=' + desc + '&crim_lastSeen=' + lastSeen 
    return true
})
$('#myform_edit').on('submit', ()=> {
    var name = document.getElementById('crim_name_edit').value
    var sex = document.getElementById('crim_sex_edit').value
    var desc = document.getElementById('crim_description_edit').value
    var lastSeen = document.getElementById('crim_lastSeen_edit').value

    var current = document.getElementById("myform_edit").action
    document.getElementById("myform_edit").action = current + "&crim_name=" + name + '&crim_sex=' + sex + '&crim_description=' + desc + '&crim_lastSeen=' + lastSeen 
    return true
})
async function recognizeFaces() {

    const labeledDescriptors = await loadLabeledImages()
    $('#loadingModal').modal('hide')
    if(labeledDescriptors == null){
        alert('No Criminals added to the database!')
        return
    }
    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.55)
    
    button.addEventListener('click', async() => {
        document.getElementById('result').innerHTML = 'Processing . . .'
        console.log('Playing')
        const canvas = faceapi.createCanvasFromMedia(video)
        document.getElementById('container').append(canvas)

        const displaySize = { width: video.width, height: video.height }
        faceapi.matchDimensions(canvas, displaySize)

        var bestData = {}
        for(let i = 0; i < 10; i++){
            const detections = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor()
            if(detections == null){
                document.getElementById('result').innerHTML = 'No face detected or Detection was interrupted!'
                return
            }
            const resizedDetections = faceapi.resizeResults(detections, displaySize)

            var bestMatch = faceMatcher.findBestMatch(resizedDetections.descriptor)
            if(bestData[bestMatch.label] == null){
                bestData[bestMatch.label] = 1
            }else{
                bestData[bestMatch.label] += 1
            }
        }
        console.log(bestData)
        var bestKey = ''
        for(const key in bestData){
            if(bestKey == ''){
                bestKey = key
                continue
            }
            if(bestData[bestKey] < bestData[key]){
                bestKey = key
            }
        }
        if(bestKey == 'unknown'){
            document.getElementById('result').innerHTML = 'No record found!'
            return
        }
        document.getElementById('result').innerHTML = bestKey + ' (' + ((bestData[bestKey] / 10) * 100) + '%)'
    })
}
function displayResults(results){
    results.forEach( (result, i) => {
        console.log(result.toString())
    })
}
//load images
async function loadLabeledImages() {
    const criminals = await $.get('/get-all-criminals', async (data) => {
        return await data;
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