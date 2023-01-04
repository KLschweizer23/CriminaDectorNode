
window.onerror = function() {
    location.reload()
}
const video = document.getElementById('videoInput')
const button = document.getElementById('videoStarter')

var automateDetection = false

$('#loadingModal').modal({ show: true });

Promise.all([
    faceapi.nets.faceRecognitionNet.loadFromUri('./models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
    faceapi.nets.ssdMobilenetv1.loadFromUri('./models') //heavier/accurate version of tiny face detector
]).then(start);
$(document).ready(function () {
    $('#dtBasicExample').DataTable()
    $('.dataTables_length').addClass('bs-select')
});

async function start() {
    $('#loadingModal').modal({ show: true })
    enableAutomaticDetection()
    if(await checkIfLoadModels()){
//         await navigator.mediaDevices.getUserMedia(
//             { video:{} },
//             async (stream) => {
//                 console.log(await stream)
//                 video.srcObject = await stream
//             },
//             err => console.error(err)
//         )
        if (await navigator.mediaDevices.getUserMedia) {
            await navigator.mediaDevices.getUserMedia({ video: true })
            .then(async function (stream) {
                video.srcObject = await stream;
                console.log(video.srcObject)

                console.log('video added')
                recognizeFaces()
            })
            .catch(function (err0r) {
                console.log("Something went wrong!");
            });
        }else{
            console.log('no video even await')
        }
    }
}

async function enableAutomaticDetection(){
    var automate = await $.get('/automate', async (data) => {
        return await data
    })
    if(automate.automate){
        $('#videoStarter').hide()
        $('#toggle-event-automate').bootstrapToggle('on')
    }else{
        $('#toggle-event-automate').bootstrapToggle('off')
    }
    $('#toggle-event-automate').change(function() {
        var status = document.getElementById('toggle-event-automate').checked
        $.get('/automate?value=' + status)
    })
    automateDetection = automate.automate
}

async function checkIfLoadModels(){
    var status = await $.get('/status', async (data) => {
        return await data
    })
    if(!status.status){
        $('#loadingModal').modal('hide')
        $('#videoStarter').hide()
        $('#result').text('Enable automatic loading of models in the settings')
        $('#toggle-event').bootstrapToggle('off');
    }
    $('#toggle-event').change(function() {
        var status = document.getElementById('toggle-event').checked
        $.get('/status?value=' + status)
    })
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
$('#myform').on('submit', ()=> {
    if($('#image').val() == '') return false
    
    var name = document.getElementById('crim_name').value
    var sex = document.getElementById('crim_sex').value
    var desc = document.getElementById('crim_description').value
    var lastSeen = document.getElementById('crim_lastSeen').value
    var violation = document.getElementById('crim_violation').value

    document.getElementById("myform").action = "/upload?crim_name=" + name + '&crim_sex=' + sex + '&crim_description=' + desc + '&crim_lastSeen=' + lastSeen + '&crim_violation=' + violation
    return true
})
async function recognizeFaces() {
    console.log(video.srcObject)
    console.log('loading images...')
    const labeledDescriptors = await loadLabeledImages()
    $('#loadingModal').modal('hide')
    console.log('done loading images')
    if(labeledDescriptors == null){
        alert('No Criminals added to the database!')
        return
    }
    console.log('loading facematcher...')
    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.55)
    console.log('done loading facematcher')
    console.log(automateDetection)
    if(automateDetection){
        const canvas = faceapi.createCanvasFromMedia(video)

        const displaySize = { width: video.width, height: video.height }
        faceapi.matchDimensions(canvas, displaySize)
        var readyForDetection = true
        const interval = setInterval(async () =>{
            if(readyForDetection){
                console.log('still here')
                document.getElementById('result').innerHTML = 'Ready'

                const detections = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor()
                setTimeout(() => {console.log('Process detection')}, 300)
                if(await detections != null){
                    readyForDetection = false   
                    console.log('Detected Something')
                    document.getElementById('result').innerHTML = 'Processing . . .'
                    var bestData = {}
                    var errorMargin = 0
                    for(let i = 0; i < 10; i++){
                        const detections = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor()
                        if(detections == null){
                            errorMargin += 1
                            if(errorMargin == 3){
                                document.getElementById('result').innerHTML = 'No face detected or Detection was interrupted!'
                                readyForDetection = true
                                return
                            }
                            continue
                        }
                        const resizedDetections = faceapi.resizeResults(detections, displaySize)
                        
                        var bestMatch = faceMatcher.findBestMatch(resizedDetections.descriptor)
                        if(bestData[bestMatch.label] == null){
                            bestData[bestMatch.label] = 1
                        }else{
                            bestData[bestMatch.label] += 1
                        }
                    }
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
                    }else{
                        document.getElementById('result').innerHTML = bestKey + ' (' + ((bestData[bestKey] / 10) * 100) + '%)'
                        criminalFound(bestKey, ((bestData[bestKey] / 10) * 100))
                    }
                    setTimeout(() => {
                        console.log('SHOW RESULT WAIT TIME')
                        readyForDetection = true
                    }, 3000)
                }
            }
        }, 500)
    }else{
        console.log(video.srcObject)
        button.addEventListener('click', async() => {
            console.log(video.srcObject)
            console.log('Playing')
            const canvas = await faceapi.createCanvasFromMedia(video)
            
            const displaySize = { width: video.width, height: video.height }
            faceapi.matchDimensions(canvas, displaySize)
            processDetection(faceMatcher, displaySize)
        })
    }
}

async function criminalFound(name, percentage){
    var address = $('#detectionAddress').val()
    if(address == ''){
        address = 'Unknown Area'
    }

    showResultInPopup(name)

    $.post('/criminal-detected', {name: name, percentage: percentage, address: address})
}

async function showResultInPopup(name){
    var data = await $.get('/getCriminal?name=' + name, async (data) => {
        return data
    })
    document.getElementById("result_crimImage").src = data.url
    $('#result_name').text(data.name)
    $('#result_violation').text(data.violation)
    $('#result_description').text(data.description)
    $('#resultModal').modal({show: true})
}

async function sendReport(){
    var address = $('#detectionAddress').val()
    var name = $('#result_name').text()
    $.post('/report', {address: address, name: name})
    $('#resultModal').modal('hide')
}

async function processDetection(faceMatcher, displaySize){
    document.getElementById('result').innerHTML = 'Processing . . .'
    var bestData = {}
    var errorMargin = 0
    for(let i = 0; i < 10; i++){
        const detections = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor()
        if(detections == null){
            errorMargin += 1
            if(errorMargin == 3){
                document.getElementById('result').innerHTML = 'No face detected or Detection was interrupted!'
                return
            }
            continue
        }
        const resizedDetections = faceapi.resizeResults(detections, displaySize)

        var bestMatch = faceMatcher.findBestMatch(resizedDetections.descriptor)
        if(bestData[bestMatch.label] == null){
            bestData[bestMatch.label] = 1
        }else{
            bestData[bestMatch.label] += 1
        }
    }
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
    criminalFound(bestKey, ((bestData[bestKey] / 10) * 100))
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
