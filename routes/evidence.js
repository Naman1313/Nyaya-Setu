// const express =require("express");
// const router=express.Router;
// const evidence=require("evidence.js");


// // CREATE evidence
// // Show all evidence
// router.get('/show', async (req, res) => {
//   try {
//     const evidences = await evidence.find();
//     res.render('show', { evidences }); // render show.ejs and pass data
//   } catch (err) {
//     res.status(500).send('Server Error');
//   }
// });

// // Add new evidence
// router.post('/evidence', async (req, res) => {
//   try {
//     const newEvidence = new evidence(req.body);
//     await newEvidence.save();
//     res.redirect('/show'); // redirect to show page after adding
//   } catch (err) {
//     res.status(500).send('Error adding evidence');
//   }
// });
// const crypto = require('crypto');
// const fs = require('fs');
// // Route to display the Verification Page

// // UPDATE evidence

// module.exports = router;



