var admin = require('firebase-admin');
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const port = 3000
require('dotenv').config()

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_CONFIG))
});

const db=admin.firestore()
var jsonParser = bodyParser.json()
app.listen(process.env.PORT || port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})

app.get('/', jsonParser, (req,res)=>{
    let users={}
    let promises=[]
    let name=""
    let numbers=req.body.numbers
    numbers.sort((a,b)=>{
        return a-b
    })
    numbers.forEach(number=>{
        promises.push(db.collection('Users').doc(number).get().then(doc=>{
            if(doc.exists){
                name+=number
                users[number]={name: doc.data().name, balance: 0}
                console.log(users)
            }
        }))
    })
    Promise.all(promises).then(()=>{
        db.collection('Groups').doc(name).get().then(doc=>{
            if(doc.exists){
                console.log("Exists")
            }else{
                db.collection('Groups').doc(name).set({
                    members: users,
                    transactions: []
                }).then(()=>{
                    req.body.numbers.forEach(number=>{
                        db.collection('Users').doc(number).get().then(doc=>{
                            if(doc.exists){
                                db.collection('Users').doc(number).update({
                                    groups: admin.firestore.FieldValue.arrayUnion(name)
                                })
                            }
                        })
                    })
                })
            }
        })
    })
    return res.json(numbers)
})