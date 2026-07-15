const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
(async ()=>{
  try{
    console.log('Using MONGO_URI:', process.env.MONGO_URI && process.env.MONGO_URI.slice(0,80)+'...');
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser:true, useUnifiedTopology:true, serverSelectionTimeoutMS:5000 });
    console.log('Mongo connected OK');
    await mongoose.disconnect();
  }catch(err){
    console.error('Mongo connection error:', err.message);
    process.exit(1);
  }
})();
