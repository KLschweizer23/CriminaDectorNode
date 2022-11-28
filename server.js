const express = require('express')
const fs = require('fs')
const faceapi = require('face-api.js')
const Promise = require('promise')
const path = require('path')
var multer = require('multer')
const app = express()


app.use(express.static(__dirname + '/public'))

app.set('view-engine', 'ejs')

Promise.all([    
    faceapi.nets.faceRecognitionNet.loadFromDisk('./public/models'),
    faceapi.nets.faceLandmark68Net.loadFromDisk('./public/models'),
    faceapi.nets.ssdMobilenetv1.loadFromDisk('./public/models') 
])

const maxSize = 1 * 1000 * 1000
const CRIMINAL_DIR = './public/criminals'

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        var crimDir = CRIMINAL_DIR + '/' + req.query.crim
        if(!fs.existsSync(crimDir)){
            fs.mkdirSync(crimDir)
        }
        cb(null, crimDir)
    },
    filename: function (req, file, cb) {
        var crimDir = CRIMINAL_DIR + '/' + req.query.crim
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

app.get('/get-all-criminals', (req, res) => {
    var returnObject = []
    var crimDir = CRIMINAL_DIR
    var files = fs.readdirSync(crimDir, (err, files) => {
        return files
    })
    files.forEach((folder) => {
        var obj = {}
        obj['name'] = folder
        var pictures = fs.readdirSync(crimDir + '/' + folder, (err, files) => {
            return files
        })
        obj['picSize'] = pictures.length
        returnObject.push(obj)
    })
    res.send(returnObject)
})

app.listen(3000)