const store={};
global.localStorage={getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=String(v),
  removeItem:k=>{delete store[k]},clear:()=>{for(const k in store)delete store[k]},
  key:i=>Object.keys(store)[i]??null,get length(){return Object.keys(store).length}};
const fake={innerHTML:'',insertAdjacentHTML(){},scrollTop:0,className:'',textContent:'',
  appendChild(){},remove(){},click(){},addEventListener(){},style:{},href:'',download:''};
global.document={querySelector:()=>fake,querySelectorAll:()=>[],createElement:()=>({...fake,style:{}}),
  body:{appendChild(){}},getElementById:()=>fake};
global.window={print(){},addEventListener(){}};
global.alert=()=>{};global.confirm=()=>true;global.prompt=()=>null;
global.URL={createObjectURL:()=>'blob:x',revokeObjectURL(){}};
const fs=require('fs');
/* relativo al repo, para que corra igual en otra máquina y en GitHub Actions */
const src=fs.readFileSync(require('path').join(__dirname,'..','clap.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const tst=fs.readFileSync(process.argv[2],"utf8");
/* las pruebas de la lógica arrancan con el ejemplo CHICO (test/ejemplo-chico.js,
   números fijos); las que prueban el ejemplo de la app llaman a sembrar() (Brisa) */
const chico=fs.readFileSync(require('path').join(__dirname,'ejemplo-chico.js'),'utf8');
eval(src+'\n;\n'+chico+'\n;\ntry{ DB = dbVacia(); sembrarChico(); }catch(e){ console.log("FALLA no pude armar el ejemplo chico: " + e.message); }\n;\n'+tst);
