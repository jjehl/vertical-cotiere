const sharp=require('sharp');
module.exports=async()=>{
  const pixels=Buffer.alloc(64*64*3);
  for(let i=0;i<pixels.length;i++)pixels[i]=(i*17+(i>>4)*29)%256;
  const original=await sharp(pixels,{raw:{width:64,height:64,channels:3}}).withMetadata({orientation:6}).jpeg().toBuffer();
  const marker=original.indexOf(Buffer.from([0xff,0xda]));
  const start=marker+2+original.readUInt16BE(marker+2);
  // Retain the JPEG headers and end marker, but cut the encoded pixel segment.
  const damaged=Buffer.concat([original.subarray(0,start+Math.floor((original.length-start-2)/2)),Buffer.from([0xff,0xd9])]);
  return {original,damaged};
};
