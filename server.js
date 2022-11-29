const express = require('express')
const fs = require('fs')
const bcrypt = require('bcrypt')
const faceapi = require('face-api.js')
const tf = require('@tensorflow/tfjs-node')
const Promise = require('promise')
const path = require('path')
var multer = require('multer')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
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
        var crimDir = CRIMINAL_DIR + '/' + req.query.crim_name
        if(!fs.existsSync(crimDir)){
            fs.mkdirSync(crimDir)
        }
        cb(null, crimDir)
    },
    filename: function (req, file, cb) {
        var crimDir = CRIMINAL_DIR + '/' + req.query.crim_name
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

app.get('/dashboard', async (req, res) => {
    if(!fs.existsSync('status.txt')){
        fs.writeFileSync('status.txt', 'true')
    }
    const criminals = await getCriminals()
    res.render('pages/dashboard.ejs', {'criminals': await criminals})
})

app.get('/login', async (req, res) => {
    res.render('pages/login.ejs')
})

app.post('/login', express.json(), express.urlencoded(), async (req, res) => {
    await policeExist(req.body)
    .then(async (response) => {
        if(response == 'none'){
            res.send('Police Doesn\'t exist')
        }else if(response == 'bad password'){
            res.send('Wrong password')
        }else{
            res.redirect('/dashboard')
        }
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
})

app.post('/register', express.json(), express.urlencoded(), async (req, res) => {
    savePolice(req.body, req.query.update)
    .then(async () => {
        await prisma.$disconnect()
        res.redirect('/login')
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
})

app.get('/status', (req, res) => {
    var value = req.query.value
    if(!fs.existsSync('status.txt')){
        fs.writeFileSync('status.txt', 'true')
    }
    if(value == null){
        res.send({status: fs.readFileSync('status.txt').equals(Buffer.from('true'))})
    }else{
        fs.writeFileSync('status.txt', value)
    }
})

app.post('/upload', (req, res) => {
    saveCriminal(req)
    .then(async () => {
        await prisma.$disconnect()
        upload(req,res,function(err) {
            console.log(req.file)
            if(err) {
                res.send(err)
            }
            else {
                res.location('/dashboard')
            }
        })
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
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

app.get('/criminal-record', async (req, res) => {
    res.send(await getSpecificCriminal(req.query.c_id))
})

async function policeExist(data){
    var userExists = await prisma.police.findUnique({
        where:{
            badge: data.badge
        },
        select:{
            password: true
        }
    })
    if(!userExists){
        return 'none'
    }
    var checkPassword = await bcrypt.compareSync(data.password, userExists.password)
    if(checkPassword){
        return 'good'
    }
    return 'bad password'
}

async function savePolice(data, update){
    var updateValue = 0
    if(update != null){
        updateValue = Number(update)
    }
    
    var encryptedPassword = await bcrypt.hash(data.password, 10)
    return await prisma.police.upsert({
        create:{
            badge: data.badge,
            password: encryptedPassword,
            person:{
                create:{
                    name: data.fullname,
                    sex: data.sex,
                    address: data.address,
                    phoneNumber: data.phone_num,
                    role: 'police'
                }
            }
        },
        update:{
            badge: data.badge,
            password: encryptedPassword,
            person:{
                update:{
                    name: data.fullname,
                    sex: data.sex,
                    address: data.address,
                    phoneNumber: data.phone_num,
                    role: 'police'
                }
            }
        },
        where:{
            id: updateValue
        }
    })
}

async function getSpecificCriminal(id){
    return await prisma.criminal.findUnique({
        where:{
            id: Number(id)
        },
        include:{
            person: true
        }
    })
}

async function getCriminals(){
    return await prisma.criminal.findMany({
        include: {
            person: true
        }
    })
}
async function saveCriminal(req){
    var updateValue = 0
    if(req.query.update != null){
        updateValue = Number(req.query.update)
    }
    return await prisma.criminal.upsert({
        create:{
            description: req.query.crim_description,
            lastSeen: req.query.crim_lastSeen,
            person:{
                create:{
                    name: req.query.crim_name,
                    sex: req.query.crim_sex,
                    role: 'criminal'
                }
            }
        },
        update:{
            description: req.query.crim_description,
            lastSeen: req.query.crim_lastSeen,
            person:{
                update:{
                    name: req.query.crim_name,
                    sex: req.query.crim_sex,
                    role: 'criminal'
                }
            }
        },
        where:{
            id: updateValue
        }
    })
}

app.listen(3000)