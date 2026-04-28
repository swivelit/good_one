const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({

user:{
type:mongoose.Schema.Types.ObjectId,
ref:'User',
required:true,
unique:true
},

businessName:{
type:String,
required:true,
trim:true
},

businessDescription:{
type:String
},

businessCategory:{
type:String
},

businessAddress:{
type:String
},

website:{
type:String
},

logo:{
type:String,
default:''
},

coverImage:{
type:String,
default:''
},

livePhoto:{
type:String,
default:''
},

liveVideo:{
type:String,
default:''
},

isApproved:{
type:Boolean,
default:true
},

verificationStatus:{
type:String,
enum:['pending','verified','rejected'],
default:'verified'
},

rating:{
type:Number,
default:0
},

totalReviews:{
type:Number,
default:0
},

totalProducts:{
type:Number,
default:0
}

},{timestamps:true});

module.exports = mongoose.model('Vendor',vendorSchema);