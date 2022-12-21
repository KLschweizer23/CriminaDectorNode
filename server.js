if(process.env.NODE_ENV !== 'production'){
    require('dotenv').config()
}

const express = require('express')
const fs = require('fs')
const os = require('os')
const bcrypt = require('bcrypt')
const faceapi = require('face-api.js')
const tf = require('@tensorflow/tfjs-node')
const Promise = require('promise')
const path = require('path')
var multer = require('multer')
const { PrismaClient } = require('@prisma/client')
const mysql = require('mysql2')

const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')

const prisma = new PrismaClient()
const app = express()
const initializePassport = require('./passport-config')
const { data } = require('@tensorflow/tfjs-node')
initializePassport(
    passport,
    async badge => {
        const findPolice = await prisma.police.findUnique({
            where:{
                badge: badge
            }
        })
    },
    async id => {
        const findPolice = await prisma.police.findUnique({
            where:{
                id: id
            }
        })
    }
)

app.use(express.static(__dirname + '/public'))
app.use(flash())
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())

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

const pool = mysql.createPool({
    host: "sql.freedb.tech",
    user: "freedb_police_user",
    password: "9#VMNfVRugDtc&w",
    database: "freedb_criminadector_node"
})

pool.getConnection((err, con) => {
    if(err) console.log(err)
    console.log('Connected successfully')
})

app.get('/', async (req, res) => {
    const logs = await getCriminalLogs()
    res.render('pages/index.ejs', {'authenticated': req.isAuthenticated(), 'logs': await logs})
})

app.get('/dashboard', checkAuthenticated, async (req, res) => {
    const criminals = await getCriminals()
    const logs = await getCriminalLogs()
    const activities = await getActivityLogs()
    res.render('pages/dashboard.ejs', {
        'criminals': await criminals,
        'authenticated': req.isAuthenticated(),
        'criminalLogs': await logs,
        'activityLogs': await activities
    })
})

app.get('/login', checkNotAuthenticated, async (req, res) => {
    res.render('pages/login.ejs', {'authenticated': req.isAuthenticated()})
})

function removeWord(arr, word) {
    for (var i = 0; i < arr.length; i++){
        arr[i] = arr[i].replace(word,'');
    }
}

app.get('/criminal/:id', checkAuthenticated, async (req, res) => {
    var criminal = await getCriminal(req.params.id)
    var pics = []
    var pictures = await fs.readdirSync(CRIMINAL_DIR + '/' + criminal.person.name, async (err, files) => {
        return await files
    })
    removeWord(pictures, ".jpg")
    for(var i = 0; i < pictures.length; i++){
        var pic = {}
        pic['name'] = criminal.person.name
        pic['id'] = pictures[i]
        pics.push(pic)
    }
    res.render('pages/criminal.ejs', {
        'authenticated': req.isAuthenticated(),
        'criminal': criminal,
        'pictures': pics
    })
})

app.get('/delete-image', express.json(), express.urlencoded(), (req, res) => {
    var id = req.query.id
    var name = req.query.name
    if(fs.existsSync(CRIMINAL_DIR + '/' + name + '/' + id + '.jpg')){
        fs.rmSync(CRIMINAL_DIR + '/' + name + '/' + id + '.jpg')
        reArrangeImages(name)
    }
    res.end()
})

app.post('/login', express.json(), express.urlencoded(), checkNotAuthenticated, mwSaveLog, passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/login',
    failureFlash: true
}))

function mwSaveLog(req, res, next){
    saveActivityLog(req.body.badge, "Police with badge " + req.body.badge + " has logged in")
    next()
}

app.post('/logout', (req, res) => {
    var id = req.session.passport.user
    req.logOut(async (err) => {
        if(err){
            return next(err)
        }
        var police = await getCurrentPoliceById(id)
        console.log(police)
        saveActivityLog(police.badge, "Police with badge " + police.badge + " has logged out")
        res.redirect('/login')
    })
})

app.post('/register', express.json(), express.urlencoded(), async (req, res) => {
    await savePolice(req.body, req.query.update)
    .then(async (data) => {
        await prisma.$disconnect()
        console.log(data)
        if(data == null){
            res.redirect('/login?error=true')
        }
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
    if(value == null){
        res.send({status: getSettingsValues("STATUS") === 'true'})
    }else{
        setSettingsValues("STATUS", value)
        res.end()
    }
})
app.get('/automate', (req, res) => {
    var value = req.query.value
    if(value == null){
        res.send({automate: getSettingsValues("AUTO_DETECT") === 'true'})
    }else{
        setSettingsValues("AUTO_DETECT", value)
        res.end()
    }
})

app.post('/upload', (req, res) => {
    var id = req.session.passport.user
    var name = req.query.crim_name
    console.log(id)
    saveCriminal(req)
    .then(async () => {
        await prisma.$disconnect()
        upload(req,res, async function(err) {
            if(err) {
                res.send(err)
            }
            else {
                var police = await getCurrentPoliceById(id)
                saveActivityLog(police.badge, "Police with badge " + police.badge + " has added " + name + " as a new criminal/suspect")
                res.redirect('/dashboard')
            }
        })
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
})

app.post('/upload-image', (req, res) => {
    upload(req,res, async function(err) {
        if(err) {
            res.send(err)
        }
        res.redirect('/criminal/' + req.query.id)
    })
})

app.post('/delete', (req, res) => {
    var id = req.query.id
    var pid = req.session.passport.user
    deleteCriminal(id)
    .then(async (person) => {
        await prisma.$disconnect()
        if(fs.existsSync(CRIMINAL_DIR + '/' + person.name)){
            fs.rmSync(CRIMINAL_DIR + '/' + person.name, { recursive: true, force: true })
        }
        var police = await getCurrentPoliceById(pid)
        saveActivityLog(police.badge, "Police with badge " + police.badge + " has deleted " + person.name + " record")
        res.redirect('/dashboard')
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

app.post('/criminal-detected', express.json(), express.urlencoded(), async (req, res) => {
    saveLog(req.body)
    res.end()
})

async function reArrangeImages(name){
    if(fs.existsSync(CRIMINAL_DIR + '/' + name)){
        var files = fs.readdirSync(CRIMINAL_DIR + '/' + name, (err, files) => {
            return files
        })
        var mainDir = CRIMINAL_DIR + '/' + name
        for(var i = 0; i < files.length; i++){
            fs.rename(mainDir + '/' + files[i], mainDir + '/' + (i + 1) + '.jpg', (err) => {
                if(err) console.log(err)
            })
        }
    }
}

async function saveActivityLog(badge, message){
    var police = await prisma.police.findUnique({
        where:{
            badge: badge
        }
    })
    if(police == null){
        return
    }
    await prisma.activityLogs.create({
        data:{
            policeId: police.id,
            message: message
        }
    })
}

async function getCriminalLogs(){
    return await prisma.logs.findMany({
        orderBy:{
            date_time: 'desc'
        }
    })
}

async function getActivityLogs(){
    return await prisma.activityLogs.findMany({
        take: 10,
        orderBy:{
            date_time: 'desc'
        },
        include:{
            police:{
                include:{
                    person: true
                }
            }
        }
    })
}

async function saveLog(data){
    await prisma.logs.create({
        data:{
            name: data.name,
            percentage: data.percentage,
            location: data.address
        }
    })
}

async function savePolice(data, update){
    var updateValue = 0
    if(update != null){
        updateValue = Number(update)
    }
    
    var pol = await prisma.police.findUnique({
        where:{
            badge: data.badge
        }
    })

    if(pol != null){
        return null
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
async function getCriminal(id){
    return await prisma.criminal.findFirst({
        where:{
            id: Number(id)
        },
        include:{
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
            violation: req.query.crim_violation,
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
            violation: req.query.crim_violation,
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

async function deleteCriminal(id){
    var criminal = await prisma.criminal.delete({
        where: {
            id: Number(id)
        }
    })

    return await prisma.person.delete({
        where: {
            id: criminal.personId
        }
    })
}

function checkAuthenticated(req, res, next) {
    if(req.isAuthenticated()){
        return next()
    }

    res.redirect('/login')
}

function checkNotAuthenticated(req, res, next){
    if(req.isAuthenticated()){
        return res.redirect('/dashboard')
    }
    next()
}

function setSettingsValues(key, value) {
    var variables = fs.readFileSync('./settings.txt', 'utf8').split("\n")
    for(let i = 0; i < variables.length; i++){
        var key_value = variables[i].split("=")
        if(key_value[0] == key){
            key_value[1] = value
            variables[i] = key_value[0] + "=" + key_value[1]
        }
    }
    fs.writeFileSync('./settings.txt', variables.join("\n"))
}

function getSettingsValues(key){
    var variables = fs.readFileSync('./settings.txt', 'utf8').split("\n")
    for(let i = 0; i < variables.length; i++){
        var key_value = variables[i].split("=")
        if(key_value[0] == key){
            return key_value[1]
        }
    }
    return null
}
async function getCurrentPoliceById(id){
    return await prisma.police.findFirst({
        where:{
            id: id
        }
    })
}
app.listen(3000)