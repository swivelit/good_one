const User = require('../Models/User');
const Vendor = require('../Models/Vendor');
const jwt = require('jsonwebtoken');
const OTP = require("../Models/otp");
const bcrypt = require("bcrypt");




const generateToken = (id) =>
jwt.sign({id},process.env.JWT_SECRET,{expiresIn:process.env.JWT_EXPIRE});



// CUSTOMER REGISTER
exports.registerCustomer = async (req, res) => {
  try {
    const { name, email, phone, password, otp } = req.body;

    // Validation
    if (!name || !email || !password || !otp) {
      return res.status(400).json({
        success: false,
        message: "All fields including OTP are required",
      });
    }

    // Check OTP
    const recentOtp = await OTP.find({ email })
      .sort({ createdAt: -1 })
      .limit(1);

    if (recentOtp.length === 0 || recentOtp[0].otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    // Check existing user
    const existing = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    // ✅ REMOVE manual bcrypt hash
    // Model will hash automatically

    // Create user
    const user = await User.create({
      name,
      email,
      phone,
      password, // ✅ plain password here
      role: "customer",
    });

    // Generate token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      token,
      user,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


exports.registerVendor = async (req, res) => {


  try {
   
    const {
      name,
      email,
      phone,
      password,
      otp,
      businessName,
      businessDescription,
      businessCategory,
      businessAddress
    } = req.body;

  
    if (!name || !email || !phone|| !password || !otp || !businessName) {
    
     return res.status(400).json({
        success: false,
        message: "All required fields missing"
      });
    }

 

    const recentOtp = await OTP.find({ email })
      .sort({ createdAt: -1 })
      .limit(1);

  

    if (recentOtp.length === 0) {
    

      return res.status(400).json({
        success: false,
        message: "OTP expired"
      });
    }

 
    if (recentOtp[0].otp.toString() !== otp.toString()) {
     

      return res.status(400).json({
        success: false,
        message: "Invalid OTP"
      });
    }


    const existing = await User.findOne({
      $or: [{ email }, { phone }]
    });

  

    if (existing) {
      console.log("❌ User Already Exists");

      return res.status(400).json({
        success: false,
        message: "User already exists"
      });
    }


    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: "vendor"
    });

   
    const livePhoto =
      req.files?.livePhoto?.[0]?.filename || "";

 
    const vendor = await Vendor.create({
      user: user._id,
      businessName,
      businessDescription,
      businessCategory,
      businessAddress,
      livePhoto
    });

    await OTP.deleteMany({ email });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user,
      vendor
    });

  } catch (error) {
 
res.status(500).json({
      success: false,
      message: error.message
    });
  }
};





// LOGIN
exports.login = async(req,res)=>{
try{

const {emailOrPhone,password} = req.body;

const user = await User.findOne({
$or:[
{email:emailOrPhone},
{phone:emailOrPhone}
]
});

if(!user || !(await user.matchPassword(password))){
return res.status(401).json({
success:false,
message:"Invalid credentials"
});
}

const token = generateToken(user._id);

let vendorProfile=null;

if(user.role === 'vendor'){
vendorProfile = await Vendor.findOne({user:user._id});
}

res.json({
success:true,
token,
user,
vendorProfile
});

}catch(error){
res.status(500).json({success:false,message:error.message});
}
};




// GET CURRENT USER
exports.getMe = async(req,res)=>{
try{

const user = req.user;

let vendorProfile=null;

if(user.role === 'vendor'){
vendorProfile = await Vendor.findOne({user:user._id});
}

res.json({
success:true,
user,
vendorProfile
});

}catch(error){
res.status(500).json({success:false,message:error.message});
}
};