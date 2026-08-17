export type Zoo = { id:string; name:string; city:string; country:"NL"|"BE"|"DE"; distance:number; price:number; rating?:number; visited:boolean; emoji:string; color:string; intro:string; highlights:string[] };
export const zoos: Zoo[] = [
 {id:"burgers",name:"Burgers’ Zoo",city:"Arnhem",country:"NL",distance:46,price:27.5,rating:9.2,visited:true,emoji:"🦁",color:"#abc2a8",intro:"Reis op één dag door de Bush, Desert en Ocean.",highlights:["Bush","Mangrove","Ocean"]},
 {id:"gaia",name:"GaiaZOO",city:"Kerkrade",country:"NL",distance:178,price:26.5,rating:8.8,visited:true,emoji:"🦒",color:"#e8c18f",intro:"Een heuvelachtig dierenpark vol bijzondere werelden.",highlights:["Savanna","Limburg","Giraffes"]},
 {id:"blijdorp",name:"Diergaarde Blijdorp",city:"Rotterdam",country:"NL",distance:84,price:29.5,rating:8.5,visited:true,emoji:"🐘",color:"#b9d2ce",intro:"Monumentale dierentuin met Oceanium midden in Rotterdam.",highlights:["Oceanium","Monumenten"]},
 {id:"pairi",name:"Pairi Daiza",city:"Brugelette",country:"BE",distance:238,price:42,emoji:"🐼",color:"#d4b9c7",visited:false,intro:"Een sprookjesachtige wereldreis tussen tuinen en tempels.",highlights:["Panda's","Tuinen","Trein"]},
 {id:"antwerpen",name:"ZOO Antwerpen",city:"Antwerpen",country:"BE",distance:146,price:32.5,emoji:"🦩",color:"#e7b2a5",visited:false,intro:"Historische stadsdierentuin naast het centraal station.",highlights:["Historisch","Stadspark"]},
 {id:"apenheul",name:"Apenheul",city:"Apeldoorn",country:"NL",distance:38,price:28,emoji:"🐒",color:"#bac99d",visited:false,intro:"Wandel tussen honderden loslopende apen in het groen.",highlights:["Loslopende apen","Bos"]},
 {id:"leipzig",name:"Zoo Leipzig",city:"Leipzig",country:"DE",distance:574,price:24,emoji:"🐯",color:"#dec28e",visited:false,intro:"Gondwanaland brengt een tropisch regenwoud naar Duitsland.",highlights:["Gondwanaland","Boottocht"]},
 {id:"berlin",name:"Zoo Berlin",city:"Berlin",country:"DE",distance:654,price:25.5,emoji:"🐻",color:"#b7c9d2",visited:false,intro:"Een beroemde stadszoo met ongelooflijk veel diersoorten.",highlights:["Panda's","Aquarium"]},
];
