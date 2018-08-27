import { version } from '../../package.json';
import { Router } from 'express';
import facets from './facets';

require('dotenv').config(); // for access to environment variables
var BigNumber = require('bignumber.js');
var Web3 = require('web3')
var Tx = require('ethereumjs-tx');
var web3 = new Web3(new Web3.providers.HttpProvider(process.env.API_URL));


export default ({ config, db }) => {
	let api = Router();
	
	// mount the facets resource
	api.use('/facets', facets({ config, db }));
	
	// perhaps expose some API metadata at the root
	api.get('/', (req, res) => {
		res.json({ version });
	});
	
	api.get('/createWallet', (req, res) => {
		//create wallet
		var new_account = web3.eth.accounts.create(web3.utils.randomHex(32));
		res.setHeader('Content-Type', 'application/json');
		res.send(JSON.stringify({ publicAddress: new_account.address, privateKey:new_account.privateKey }));
	});
	
	api.get('/getBalance/:param', (req, res) => {
		//get balance for ETH address param
		res.setHeader('Content-Type', 'application/json');
		var address = req.params.param;		
		var balance = web3.eth.getBalance(address, function (error, result) {
			if (!error) {
				console.log('Balance: ' + web3.utils.fromWei(result, 'ether'));
				res.send(JSON.stringify({ address: address, balance: web3.utils.fromWei(result, 'ether') }));
				} else {
				console.error(error);
				res.send(JSON.stringify({ error: error.toString(), address: address }));
			}
		});
		
	});
	
	api.post('/transaction', (req, res) => {		
		//initiate transaction upon POST request: send 'amount' to 'destination' using 'privateKey'
		res.setHeader('Content-Type', 'application/json');
		const key_param=req.body.privateKey;
		const privateKey = new Buffer(key_param, 'hex');
		const destination = req.body.destination;
		const amount = req.body.amount; // in ETH!
		var count;
		// check supplied private key against stored one
		var verified = (key_param==process.env.KEY_PRIVATE ? true : false); 
		
		// transaction count for use as nonce
		web3.eth.getTransactionCount(process.env.ACCOUNT).then(function(v){
			console.log("Count: "+v);
			count = v;
			
			var rawTx = {
				nonce: web3.utils.toHex(count),
				gasPrice: web3.utils.toHex(20*1e9),
				gasLimit: web3.utils.toHex(210000),
				to: destination,
				value: web3.utils.toWei(amount, 'ether'),
				data: '0x'
			}
			console.log(rawTx);
			
			var tx = new Tx(rawTx);
			tx.sign(privateKey);
			
			var serializedTx = tx.serialize();
			if(verified){
				
				web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
				.on('receipt', function(receipt){
					console.log(receipt);
					res.send(JSON.stringify({ destination: destination, amount:amount, result:receipt.toString() }));
				})
				.on('confirmation', function(confirmationNumber, receipt){ 
					//console.log(confirmationNumber);
					res.send(JSON.stringify({ destination: destination, amount:amount, status: 'confirmed'}));
				})
				.on('error', function(error) {
					console.error(error);
					res.send(JSON.stringify({ destination: destination, amount:amount, error: error.toString()}));
				});
				} else{ 
				res.send(JSON.stringify({ destination: destination, amount:amount, error: 'private Key not valid'}));
			}
		});		
		
	});	
	
	return api;
}
