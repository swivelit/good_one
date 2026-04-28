const express = require('express');
const router = express.Router();

const {
registerCustomer,
registerVendor,
login,
getMe
} = require('../Controllers/authController');

const {protect} = require('../middleware/auth');

const multer = require('multer');

const storage = multer.diskStorage({

destination:(req,file,cb)=>{
cb(null,'uploads/')
},

filename:(req,file,cb)=>{
cb(null,Date.now()+'-'+file.originalname)
}

});

const upload = multer({storage});

router.post('/register/customer',registerCustomer);

router.post(
'/register/vendor',
upload.fields([
{name:'livePhoto',maxCount:1},
{name:'liveVideo',maxCount:1}
]),
registerVendor
);

router.post('/login',login);

router.get('/me',protect,getMe);

module.exports = router;