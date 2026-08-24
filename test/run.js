const store={};
global.localStorage={getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=v};
const fake={innerHTML:'',insertAdjacentHTML(){},scrollTop:0,className:'',textContent:'',
  appendChild(){},remove(){},click(){},addEventListener(){},style:{},href:'',download:''};
global.document={querySelector:()=>fake,querySelectorAll:()=>[],createElement:()=>({...fake,style:{}}),
  body:{appendChild(){}},getElementById:()=>fake};
global.window={print(){},addEventListener(){}};
global.alert=()=>{};global.confirm=()=>true;global.prompt=()=>null;
global.URL={createObjectURL:()=>'blob:x',revokeObjectURL(){}};
const fs=require('fs');
const src=fs.readFileSync('D:/Cuadro/clap.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const tst=fs.readFileSync(process.argv[2],"utf8");
eval(src+'\n;\n'+tst);
