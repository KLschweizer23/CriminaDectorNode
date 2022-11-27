const express = require('express')
const fs = require('fs')
const faceapi = require('face-api.js')
const Promise = require('promise')
const path = require('path')
var multer = require('multer')
const app = express()


app.use(express.static(__dirname + '/public'))
// app.use(express.json({
//     type: "*/*"
// }))

app.set('view-engine', 'ejs')

Promise.all([    
    faceapi.nets.faceRecognitionNet.loadFromDisk('./public/models'),
    faceapi.nets.faceLandmark68Net.loadFromDisk('./public/models'),
    faceapi.nets.ssdMobilenetv1.loadFromDisk('./public/models') 
])

const maxSize = 1 * 1000 * 1000
const CRIMINAL_DIR = './criminals'

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        var crimDir = CRIMINAL_DIR + '/' + req.query.crim
        if(!fs.existsSync(crimDir)){
            fs.mkdirSync(crimDir)
        }
        if(!fs.existsSync(crimDir + '/picture')){
            fs.mkdirSync(crimDir + '/picture')
        }
        crimDir = crimDir + '/picture'
        cb(null, crimDir)
    },
    filename: function (req, file, cb) {
        var crimDir = CRIMINAL_DIR + '/' + req.query.crim + '/picture'
        var files = fs.readdirSync(crimDir, (err, files) => {
            return files.length
        })
        cb(null, (files.length + 1) + ".jpg")
    }
  })

  var upload = multer({ 
    storage: storage,
    limits: { fileSize: maxSize },
    fileFilter: function (req, file, cb){
    
        // Set the filetypes, it is optional
        var filetypes = /jpeg|jpg|png/;
        var mimetype = filetypes.test(file.mimetype);
  
        var extname = filetypes.test(path.extname(
                    file.originalname).toLowerCase());
        
        if (mimetype && extname) {
            return cb(null, true);
        }
      
        cb("Error: File upload only supports the "
                + "following filetypes - " + filetypes);
      }
  
// mypic is the name of file attribute
}).single("image");  

app.get('/', async (req, res) => {

    res.render('pages/index.ejs')
})

app.get('/dashboard', (req, res) => {
    res.render('pages/dashboard.ejs')
})

app.post('/upload-descriptor', express.json(), (req, res) => {
    console.log(req.body.descriptor)
    
    var crimDir = CRIMINAL_DIR + '/' + req.body.name
    if(!fs.existsSync(crimDir)){
        fs.mkdirSync(crimDir)
    }
    if(!fs.existsSync(crimDir + '/descriptor')){
        fs.mkdirSync(crimDir + '/descriptor')
    }
    crimDir = crimDir + '/descriptor'
    var descriptor = ''
    for(let i = 0; i < 128; i++){
        if(i == 0){
            descriptor = req.body.descriptor[i]
            continue
        }
        descriptor += ',' + req.body.descriptor[i] 
    }

    var files = fs.readdirSync(crimDir, (err, files) => {
        return files.length
    })

    fs.writeFileSync(crimDir + '/' + (files.length + 1) + ".txt", descriptor)

    res.send(JSON.stringify({message: 'RECEIVED'}))
})

async function sample(label, descriptors){
    const descriptions = []
    descriptions.push(descriptors)
    console.log(await faceapi.LabeledFaceDescriptors(label, new Float32Array(descriptions)))
}

app.post('/upload', (req, res) => {
    upload(req,res,function(err) {
        if(err) {
            res.send(err)
        }
        else {
            res.send("Success, Image uploaded!")
        }
    })
})

async function processImages() {
    //const labels = ['Black Widow', 'Captain America', 'Hawkeye' , 'Jim Rhodes', 'Tony Stark', 'Thor', 'Captain Marvel']
    const labels = ['KL'] // for WebCam
    return Promise.all(
        labels.map(async(label)=>{
            const descriptions = []
            console.log(label)
            for(let i=1; i<=2; i++) {
                
                //const img_c = (await canvas.loadImage('./public/labeled_images/' + label + '/' + i + '.jpg')).src
                //const img = await canvas.loadImage(`./public/labeled_images/${label}/${i}.jpg`)
                // console.log(imge_c)
                //const img = await faceapi.fetchImage(`./public/labeled_images/${label}/${i}.jpg`)
                const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor()
                faceapi.computeFaceDescriptor()
                console.log(detections)
                descriptions.push(new Float32Array(detections.descriptor))
            }
            return new faceapi.LabeledFaceDescriptors(label, descriptions)
        })
    )
}

app.listen(3000)