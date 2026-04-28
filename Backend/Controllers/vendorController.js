const Vendor = require('../Models/Vendor');
const Product = require('../Models/Product');


// GET ALL VENDORS
exports.getVendors = async(req,res)=>{

try{

const vendors = await Vendor.find({isApproved:true})
.populate('user','name avatar');

res.json({
success:true,
vendors
});

}catch(error){
res.status(500).json({success:false,message:error.message});
}

};



// GET SINGLE VENDOR
exports.getVendor = async(req,res)=>{

try{

const vendor = await Vendor.findById(req.params.id)
.populate('user','name email avatar');

res.json({
success:true,
vendor
});

}catch(error){
res.status(500).json({success:false,message:error.message});
}

};



// GET MY PROFILE
exports.getMyProfile = async(req,res)=>{

try{

const vendor = await Vendor.findOne({
user:req.user._id
}).populate('user','name email phone avatar');

res.json({
success:true,
vendor
});

}catch(error){
res.status(500).json({success:false,message:error.message});
}

};