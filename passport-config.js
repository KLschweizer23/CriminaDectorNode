const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

const LocalStrategy = require('passport-local').Strategy
function initialize(passport, getUserByBadge, getUserById){
    const authenticateUser = async (badge, password, done) => {
        const police = await prisma.police.findFirst({
            where:{
                badge: badge
            }
        })
        if(police == null){
            return done(null, false, { message: 'Police doesn\'t exist' })
        }
        try{
            if(await bcrypt.compare(password, police.password)){
                return done(null, police)
            }else{
                return done(null, false, { message: 'Password Incorrect'})
            }
        }catch(e){
            return done(e)
        }
    }
    passport.use(new LocalStrategy({
        usernameField: 'badge'
    }, authenticateUser))
    passport.serializeUser((police, done) => done(null, police.id))
    passport.deserializeUser((id, done) => {
        return done(null, getUserById(id))
    })
}

module.exports = initialize