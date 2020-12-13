const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const fs = require('fs');

server.on('error', (err) => {
    console.log(`server error:\n${err.stack}`);
    server.close();
});
  
server.on('message', (msg, rinfo) => { 
    console.log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
    server.send(buildResponse(msg), rinfo.port, rinfo.address);
});
  
server.on('listening', () => {
    const address = server.address();
    console.log(`server listening ${address.address}:${address.port}`);
});

function buildResponse(data){
  var bytes = Buffer.from(data);

  console.log(bytes);

  var transactionID = hex2bin(bytes[0]) + "" + hex2bin(bytes[1]);
  var flags = getFlags(bytes[2].toString(16), bytes[3].toString(16));
  var QDCOUNT = '0000000000000001';
  var {zone, QT, domain} = getRecords(bytes);
  var ANCOUNT = zone[QT].length.toString(2).padStart(16, '0');
  var NSCOUNT = zone.ns.length.toString(2).padStart(16, '0');
  var ARCOUNT = '0'.toString(2).padStart(16, '0');

  var dnsHeader = transactionID + flags + QDCOUNT + ANCOUNT + NSCOUNT + ARCOUNT;
  
  var dnsBody = '';

  var dnsQuestion = buildQuestion(domain, QT);

  for(rec in zone[QT]){
    dnsBody += recordsToBytes(domain, QT, zone[QT][rec].ttl, zone[QT][rec].value);
  }

  return dnsHeader + dnsQuestion + dnsBody;
}

function getFlags(byte1, byte2){

  var bit = hex2bin(byte1);

  /*
  var bit2 = hex2bin(byte2);

  //Byte 1
  var QR = bit[0];
  var Opcode = bit[1] + "" + bit[2] + "" + bit[3] + "" + bit[4];
  var AA = bit[5];
  var TC = bit[6];
  var RD = bit[7];

  //Byte 2
  var RA = bit2[0];
  var Z = bit2[1] + "" + bit2[2] + "" + bit2[3];
  var RCODE = bit2[4] + "" + bit2[5] + "" + bit2[6] + "" + bit2[7];
  */
  return '1000010000000000';
}

function getRecords(bytes){
  var {domain, questionType} = getQuestionDomain(bytes);
  var QT = '';
  if(questionType == 001){
    QT = 'a';
  }

  var zone = getZone(domain);

  return {zone, QT, domain}
}

function getQuestionDomain(bytes){
  var length = bytes[12];
  var domain = '';
  var i = 0;

  for(; i < length; i++){
    domain += Buffer.from(bytes[13+i].toString(16), 'hex');
  }

  i = 13+length;
  length = bytes[i];
  domain += '.';

  for(var j = 0; j < length; j++, i++){
    domain += Buffer.from(bytes[i+1].toString(16), 'hex');
  }

  var questionType = bytes[i+1].toString(16) + "" + bytes[i+2].toString(16) + "" + bytes[i+3].toString(16);

  return {domain, questionType};
}

function recordsToBytes(domain, QT, ttl, value){
  var rbytes = '1100000000001100';

  if(QT == 'a'){
    rbytes += '0000000000000001';
  }

  rbytes += '0000000000000001';
  rbytes += ttl.toString(2).padStart(32, '0');

  if(QT == 'a'){
    rbytes += '0000000000000100';
  }

  for(var ip in value.split('.')){
    rbytes += text2Binary(value.split('.')[ip]).padStart(8, '0');
  }

  return rbytes;
}

function getZone(domain){

  var zones = JSON.parse(fs.readFileSync('zones.json', 'utf8'));

  for(var zone in zones){
    if(domain == zone){
      return zones[zone];
    }
  }
}

function buildQuestion(domain, QT){
  var qbytes = '';

  qbytes += domain.length.toString(2).padStart(8, '0');

  qbytes += text2Binary(domain);

  if(QT == 'a'){
    qbytes += '1'.toString(2).padStart(16, '0');
  }

  qbytes += '1'.toString(2).padStart(16, '0');

  return qbytes;
}

function bin2hex(bin){
  return parseInt(bin, 2).toString(16);
}

function hex2bin(hex){
  return (parseInt(hex, 16).toString(2)).padStart(8, '0');
}

function text2Binary(string) {
  return string.split('').map(function (char) {
      return char.charCodeAt(0).toString(2);
  }).join('');
}

server.bind(53);