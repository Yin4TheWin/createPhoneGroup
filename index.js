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
let cachedUsers=[]

db.collection("Users")
    .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                cachedUsers.push(change.doc.id)
            }
        })
});

var jsonParser = bodyParser.json()
app.listen(process.env.PORT || port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})

app.get('/check', (req, res)=>{
    let number=req.query.number
    if(!number.includes('+'))
        number="+"+number.trim()
    console.log(number, cachedUsers)
    return res.send(cachedUsers.includes(number))
})

app.get('/leave', (req,res)=>{
    let error="Unsuccess"
    let number=req.query.number, group=req.query.group
    if(!number||!group)
        return res.send("Invalid fields")
    error=number
    db.collection('Users').doc(number).get().then(userDoc=>{
        if(userDoc.exists){
            db.collection('Groups').doc(group).get().then(groupDoc=>{
                if(groupDoc.exists){
                    console.log("Group exists")
                    let members=groupDoc.data().members
                    if(number in members){
                        console.log("Number in members",  members[number])
                        delete members[number]
                        console.log(members)
                        db.collection('Users').doc(number).update({groups: admin.firestore.FieldValue.arrayRemove(groupDoc.id)})
                        let newID=groupDoc.id.replace(number,"")
                        db.collection('Groups').doc(newID).set({
                            members: members,
                            transactions: groupDoc.data().transactions
                        })
                        let promises=[]
                        Object.keys(members).forEach(member=>{
                            promises.push(db.collection('Users').doc(member).update({groups: admin.firestore.FieldValue.arrayRemove(groupDoc.id)}))
                            promises.push(db.collection('Users').doc(member).update({groups: admin.firestore.FieldValue.arrayUnion(newID)}))
                        })
                        Promise.all(promises).then(()=>{
                            db.collection('Groups').doc(group).delete().then(()=>{
                                error="success"
                            })
                        })
                    }
                }
                error="Group not found"
            })    
        }
        error="User not found"
    }).catch((err)=>{
        error=err
    })
    return res.send(error) 
})

app.post('/', jsonParser, (req,res)=>{
    let users={}
    let promises=[]
    let numbers=req.body.numbers
    numbers.sort()
    numbers.forEach(number=>{
        console.log("number init", number)
        promises.push(db.collection('Users').doc(number).get())
    })
    Promise.all(promises).then((promises)=>{
        let name=""
        console.log(promises.length)
        promises.forEach(doc=>{
            console.log("loop?")
            console.log(doc)
            if(doc.exists){
                const number = doc.id
                console.log("Number", number)
                name+=number
                users[number]={name: doc.data().name, balance: 0}
                console.log(users)
            }else{
                console.log("Not exists")
            }
        })

        console.log("Name", name)
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