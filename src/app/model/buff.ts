export enum BuffScope {
    Unknown,
    Planet,
    Moon,
    Account,
}
export enum BuffType {
    Unknown,
    MetalProduction,
    CrystalProduction,
    DeuteriumProduction,
    EnergyProduction,
    AllThreeResourcesProduction,
    FleetSlot,
    ExpeditionSlot,
    ExpeditionResources,
    PlanetSlot,
    MoonSlot,
}
export class Buff {
    public Scope: BuffScope;
    public Type: BuffType;
    public ItemUuid: string;
    public Name: string;
    public Bonus?: number;
    /** Timestamp Unix en secondes (valeur brute de l'API), undefined = permanent */
    public BuffEnd?: number;
    constructor(data: Partial<Buff>) {
        this.Scope = data.Scope ?? BuffScope.Unknown;
        this.Type = data.Type ?? BuffType.Unknown;
        this.ItemUuid = data.ItemUuid ?? '';
        this.Name = data.Name ?? '';
        this.Bonus = data.Bonus;
        this.BuffEnd = data.BuffEnd;
    }
}


/*
(()=>{const d=s=>new DOMParser().parseFromString(s.replace(/<br\s*\/?>/gi,' '),'text/html').body.textContent.replace(/\s+/g,' ').trim();
const n=(t,r)=>{const m=t.match(r);return m?parseFloat(m[1].replace(',','.')):0};
const R=[[/énergie en plus/i,'Planet','EnergyProduction','p'],[/Booste\w+ de métal/i,'Planet','MetalProduction','p'],[/Booste\w+ de cristal/i,'Planet','CrystalProduction','p'],[/Booste\w+ de deutérium/i,'Planet','DeuteriumProduction','p'],[/Booste\w+ de ressources d.expédition/i,'Account','ExpeditionResources','p'],[/Booste\w+ de ressources \(/i,'Planet','AllThreeResourcesProduction','p'],[/Slots d.expédition/i,'Account','ExpeditionSlot','n'],[/Slots pour flottes/i,'Account','FleetSlot','n'],[/Extension planétaire/i,'Planet','PlanetSlot','n'],[/Extension lunaire/i,'Moon','MoonSlot','n']];
const seen=new Map();
document.querySelectorAll('.item_img_box .detail_button').forEach(a=>{const ref=a.getAttribute('ref');if(!ref||seen.has(ref))return;
const t=d(a.getAttribute('data-tooltip-title')||a.title||'');const r=R.find(x=>x[0].test(t));if(!r)return;
const bonus=r[3]=='p'?n(t,/\+\s?(\d+(?:[.,]\d+)?)\s?%/)/100:n(t,/\+\s?(\d+)/);
const duration=({'1s':'7j','4s 2j':'30j','12s 6j':'90j'})[(t.match(/Durée : (.+?) Prix/)||[])[1]]||'permanent';
seen.set(ref,{ItemUuid:ref,Name:t.split('|')[0].replace(/`/g,"'"),Scope:r[1],Type:r[2],Bonus:bonus,Duration:duration})});
const L=[...seen.values()].sort((a,b)=>a.Type.localeCompare(b.Type)||a.Bonus-b.Bonus||a.Name.localeCompare(b.Name)||a.ItemUuid.localeCompare(b.ItemUuid));
const json=JSON.stringify(L,null,2);console.log(L.length+' items');copy(json);return L})()   
 
*/
export const BUFF_TYPES: Readonly<Record<string, { scope: BuffScope, type: BuffType, bonus: number }>> = Object.freeze({
    '302b246f44585109ca5b3ed94178707d7d4c32c0': { scope: BuffScope.Planet, type: BuffType.AllThreeResourcesProduction, bonus: 0.15 }, // Boosteur de ressources (15 %) Bronze - 30j
    '828c11637d6177cf7369dddeffa63521d9f05c8c': { scope: BuffScope.Planet, type: BuffType.AllThreeResourcesProduction, bonus: 0.15 }, // Boosteur de ressources (15 %) Bronze - 90j
    'beff9da8ce9ed2a03f73fb412347ef02adf4e9f4': { scope: BuffScope.Planet, type: BuffType.AllThreeResourcesProduction, bonus: 0.2 }, // Boosteur de ressources (20 %) Bronze - 90j
    'bfc5896632e0d809947dac4d8ced39ad7974f686': { scope: BuffScope.Planet, type: BuffType.AllThreeResourcesProduction, bonus: 0.2 }, // Boosteur de ressources (20 %) Bronze - 30j
    '4fa71c28e076fd5a5f1fdba2d83b9537e7557295': { scope: BuffScope.Planet, type: BuffType.AllThreeResourcesProduction, bonus: 0.25 }, // Boosteur de ressources (25 %) Bronze - 90j
    'f76a859138dab12d181590ff46bb11d0be5b79bd': { scope: BuffScope.Planet, type: BuffType.AllThreeResourcesProduction, bonus: 0.25 }, // Boosteur de ressources (25 %) Bronze - 30j
    '98fb2c053a8bd8608e9a307fe6f94e9b87754504': { scope: BuffScope.Planet, type: BuffType.AllThreeResourcesProduction, bonus: 0.3 }, // Boosteur de ressources (30 %) Bronze - 90j
    'be06b5c24ec29aadfe9e348ec022e698a5367dd0': { scope: BuffScope.Planet, type: BuffType.AllThreeResourcesProduction, bonus: 0.3 }, // Boosteur de ressources (30 %) Bronze - 30j
    '370a7d4f976480fa054ef23068c442fc6e476301': { scope: BuffScope.Planet, type: BuffType.AllThreeResourcesProduction, bonus: 0.4 }, // Boosteur de ressources (40 %) Bronze - 30j
    '8cc0f382c3e6bb0751b42b8e9b9a0d3648313f25': { scope: BuffScope.Planet, type: BuffType.AllThreeResourcesProduction, bonus: 0.4 }, // Boosteur de ressources (40 %) Bronze - 90j
    '04d8afd5936976e32ce894b765ea8bd168aa07ef': { scope: BuffScope.Planet, type: BuffType.CrystalProduction, bonus: 0.2 }, // Booster de cristal en argent - 90j
    '422db99aac4ec594d483d8ef7faadc5d40d6f7d3': { scope: BuffScope.Planet, type: BuffType.CrystalProduction, bonus: 0.2 }, // Booster de cristal en argent - 7j
    '5b69663e3ba09a1fe77cf72c5094e246cfe954d6': { scope: BuffScope.Planet, type: BuffType.CrystalProduction, bonus: 0.2 }, // Booster de cristal en argent - 30j
    '118d34e685b5d1472267696d1010a393a59aed03': { scope: BuffScope.Planet, type: BuffType.CrystalProduction, bonus: 0.3 }, // Booster de cristal en or - 7j
    '36fb611e71d42014f5ebd0aa5a52bc0c81a0c1cb': { scope: BuffScope.Planet, type: BuffType.CrystalProduction, bonus: 0.3 }, // Booster de cristal en or - 30j
    'd45f00e8b909f5293a83df4f369737ea7d69c684': { scope: BuffScope.Planet, type: BuffType.CrystalProduction, bonus: 0.3 }, // Booster de cristal en or - 90j
    '35d96e441c21ef112a84c618934d9d0f026998fd': { scope: BuffScope.Planet, type: BuffType.CrystalProduction, bonus: 0.4 }, // Boosteur de cristal en platine - 7j
    '6bf45fcba8a6a68158273d04a924452eca75cf39': { scope: BuffScope.Planet, type: BuffType.CrystalProduction, bonus: 0.4 }, // Boosteur de cristal en platine - 30j
    '7c2edf40c5cd54ad11c6439398b83020c0a7a6be': { scope: BuffScope.Planet, type: BuffType.CrystalProduction, bonus: 0.4 }, // Boosteur de cristal en platine - 90j
    '26416a3cdb94613844b1d3ca78b9057fd6ae9b15': { scope: BuffScope.Planet, type: BuffType.DeuteriumProduction, bonus: 0.2 }, // Booster de deutérium en argent - 30j
    '6f0952a919fd2ab9c009e9ccd83c1745f98f758f': { scope: BuffScope.Planet, type: BuffType.DeuteriumProduction, bonus: 0.2 }, // Booster de deutérium en argent - 90j
    'e4b78acddfa6fd0234bcb814b676271898b0dbb3': { scope: BuffScope.Planet, type: BuffType.DeuteriumProduction, bonus: 0.2 }, // Booster de deutérium en argent - 7j
    '300493ddc756869578cb2888a3a1bc0c3c66765f': { scope: BuffScope.Planet, type: BuffType.DeuteriumProduction, bonus: 0.3 }, // Booster de deutérium en or - 30j
    '5560a1580a0330e8aadf05cb5bfe6bc3200406e2': { scope: BuffScope.Planet, type: BuffType.DeuteriumProduction, bonus: 0.3 }, // Booster de deutérium en or - 7j
    'dc5896bed3311434224d511fa7ced6fdbe41b4e8': { scope: BuffScope.Planet, type: BuffType.DeuteriumProduction, bonus: 0.3 }, // Booster de deutérium en or - 90j
    '4b51d903560edd102467b110586000bd64fdb954': { scope: BuffScope.Planet, type: BuffType.DeuteriumProduction, bonus: 0.4 }, // Booster de deutérium en platine - 7j
    '620f779dbffa1011aded69b091239727910a3d03': { scope: BuffScope.Planet, type: BuffType.DeuteriumProduction, bonus: 0.4 }, // Booster de deutérium en platine - 30j
    '831c3ea8d868eb3601536f4d5e768842988a1ba9': { scope: BuffScope.Planet, type: BuffType.DeuteriumProduction, bonus: 0.4 }, // Booster de deutérium en platine - 90j
    'bedd248aaf288c27e9351cfacfa6be03f1dbb898': { scope: BuffScope.Planet, type: BuffType.EnergyProduction, bonus: 0.4 }, // Boosteurs d'énergie en argent - 30j
    'c2bad58fcec374d709099d11d0549e59ea7e233e': { scope: BuffScope.Planet, type: BuffType.EnergyProduction, bonus: 0.4 }, // Boosteurs d'énergie en argent - 7j
    'e05aa5b9e3df5be3857b43da8403eafbf5ad3b96': { scope: BuffScope.Planet, type: BuffType.EnergyProduction, bonus: 0.4 }, // Boosteurs d'énergie en argent - 90j
    '4fa9a2273ee446284d5177fd9d60a22de01e932b': { scope: BuffScope.Planet, type: BuffType.EnergyProduction, bonus: 0.6 }, // Boosteurs d'énergie en or - 30j
    '55b52cbfb148ec80cd4e5b0580f7bed01149d643': { scope: BuffScope.Planet, type: BuffType.EnergyProduction, bonus: 0.6 }, // Boosteurs d'énergie en or - 7j
    '5ad783dcfce3655ef97b36197425718a0dad6b66': { scope: BuffScope.Planet, type: BuffType.EnergyProduction, bonus: 0.6 }, // Boosteurs d'énergie en or - 90j
    '77c36199102e074dca46f5f26ef57ce824d044dd': { scope: BuffScope.Planet, type: BuffType.EnergyProduction, bonus: 0.8 }, // Boosteurs d'énergie en platine - 7j
    'c39aa972a971e94b1d9b4d7a8f734b3d8be12534': { scope: BuffScope.Planet, type: BuffType.EnergyProduction, bonus: 0.8 }, // Boosteurs d'énergie en platine - 90j
    'dfe86378f8c3d7f3ee0790ea64603bc44e83ca47': { scope: BuffScope.Planet, type: BuffType.EnergyProduction, bonus: 0.8 }, // Boosteurs d'énergie en platine - 30j
    '3fe4fb984a1b2bd29e8c14f9f25bea2389727b5e': { scope: BuffScope.Account, type: BuffType.ExpeditionResources, bonus: 0.1 }, // Boosteur de ressources d'expédition (10 %) Bronze - 7j
    '586b20cfd60ef85c6670b62435ca2f44f1071bd8': { scope: BuffScope.Account, type: BuffType.ExpeditionResources, bonus: 0.1 }, // Boosteur de ressources d'expédition (10 %) Bronze - 30j
    'be998009fff22d7eea987cf974a25cacc06d330c': { scope: BuffScope.Account, type: BuffType.ExpeditionResources, bonus: 0.1 }, // Boosteur de ressources d'expédition (10 %) Bronze - 90j
    '6c482898a61fa9ad20e9ce330975f07aa1f76520': { scope: BuffScope.Account, type: BuffType.ExpeditionResources, bonus: 0.15 }, // Boosteur de ressources d'expédition (15 %) Bronze - 7j
    '93eab867affae30157fc660899d9eac7d3b4f971': { scope: BuffScope.Account, type: BuffType.ExpeditionResources, bonus: 0.15 }, // Boosteur de ressources d'expédition (15 %) Bronze - 90j
    'e4b33192361f45f4c61691844d0e8ec95fa5a231': { scope: BuffScope.Account, type: BuffType.ExpeditionResources, bonus: 0.15 }, // Boosteur de ressources d'expédition (15 %) Bronze - 30j
    '01c49a959ed989bd1b86abf0526f91ac0b716bfe': { scope: BuffScope.Account, type: BuffType.ExpeditionResources, bonus: 0.2 }, // Boosteur de ressources d'expédition (20 %) Bronze - 90j
    '03ece11ef535f5ef49b203ff50a0466fda5a76e2': { scope: BuffScope.Account, type: BuffType.ExpeditionResources, bonus: 0.2 }, // Boosteur de ressources d'expédition (20 %) Bronze - 30j
    '335efdb763687e956dfe6a330ceddd32f174d753': { scope: BuffScope.Account, type: BuffType.ExpeditionResources, bonus: 0.2 }, // Boosteur de ressources d'expédition (20 %) Bronze - 7j
    '0049d2538081bea1dc5264a2899a194fe79107f1': { scope: BuffScope.Account, type: BuffType.ExpeditionResources, bonus: 0.25 }, // Boosteur de ressources d'expédition (25 %) Bronze - 30j
    '4cfd5bef27f891a1608b0d1e595cf8bf8cb144c0': { scope: BuffScope.Account, type: BuffType.ExpeditionResources, bonus: 0.25 }, // Boosteur de ressources d'expédition (25 %) Bronze - 90j
    '75154767d49fc6867c9d7465a095371993377c88': { scope: BuffScope.Account, type: BuffType.ExpeditionResources, bonus: 0.25 }, // Boosteur de ressources d'expédition (25 %) Bronze - 7j
    '5e42748915b5cab0ca7fd8e58e842ae9abb12745': { scope: BuffScope.Account, type: BuffType.ExpeditionResources, bonus: 0.3 }, // Boosteur de ressources d'expédition (30 %) Bronze - 30j
    '9c069cb845b9225f9bb191f15d4f6abb0e7e144e': { scope: BuffScope.Account, type: BuffType.ExpeditionResources, bonus: 0.3 }, // Boosteur de ressources d'expédition (30 %) Bronze - 90j
    'b9d9a0d57544363a4ac5531fa01f4b0b17256e24': { scope: BuffScope.Account, type: BuffType.ExpeditionResources, bonus: 0.3 }, // Boosteur de ressources d'expédition (30 %) Bronze - 7j
    '1b709fc34003e171528ec345430cbb2e3aa090e5': { scope: BuffScope.Account, type: BuffType.ExpeditionResources, bonus: 0.35 }, // Boosteur de ressources d'expédition (35 %) Bronze - 90j
    '2466f93d624ef96ffcc9e36f8c953699f525a5eb': { scope: BuffScope.Account, type: BuffType.ExpeditionResources, bonus: 0.35 }, // Boosteur de ressources d'expédition (35 %) Bronze - 30j
    'edd5cb7bfed46a64d4351fa6f4ef2076dc305e10': { scope: BuffScope.Account, type: BuffType.ExpeditionResources, bonus: 0.35 }, // Boosteur de ressources d'expédition (35 %) Bronze - 7j
    '3876b353a7f99b28520a82df01cd86c31b4cbfe0': { scope: BuffScope.Account, type: BuffType.ExpeditionResources, bonus: 0.4 }, // Boosteur de ressources d'expédition (40 %) Bronze - 30j
    '505fa6275e34b816d5059e26632dcaa8c18bde9a': { scope: BuffScope.Account, type: BuffType.ExpeditionResources, bonus: 0.4 }, // Boosteur de ressources d'expédition (40 %) Bronze - 7j
    'b0f6477d68c9683170cb8d32be2df1177669c5a0': { scope: BuffScope.Account, type: BuffType.ExpeditionResources, bonus: 0.4 }, // Boosteur de ressources d'expédition (40 %) Bronze - 90j
    '8c1f6c6849d1a5e4d9de6ae9bb1b861f6f7b5d4d': { scope: BuffScope.Account, type: BuffType.ExpeditionSlot, bonus: 1 }, // Slots d'expédition bronze - 30j
    'a5784c685c0e1e6111d9c18aeaf80af2e0777ab4': { scope: BuffScope.Account, type: BuffType.ExpeditionSlot, bonus: 1 }, // Slots d'expédition bronze - 90j
    'e54ecc0416d6e96b4165f24238b03a1b32c1df47': { scope: BuffScope.Account, type: BuffType.ExpeditionSlot, bonus: 1 }, // Slots d'expédition bronze - 7j
    '31a504be1195149a3bef05b9cc6e3af185d24ef2': { scope: BuffScope.Account, type: BuffType.ExpeditionSlot, bonus: 2 }, // Slots d'expédition argent - 30j
    '4f6f941bbf2a8527b0424b3ad11014502d8f4fb8': { scope: BuffScope.Account, type: BuffType.ExpeditionSlot, bonus: 2 }, // Slots d'expédition argent - 90j
    'b2bc9789df7c1ef5e058f72d61380b696dde54e8': { scope: BuffScope.Account, type: BuffType.ExpeditionSlot, bonus: 2 }, // Slots d'expédition argent - 7j
    '540410439514ac09363c5c47cf47117a8b8ae79a': { scope: BuffScope.Account, type: BuffType.ExpeditionSlot, bonus: 3 }, // Slots d'expédition or - 90j
    '9336b9f29d36e3f69b0619c9523d8bec5e09ab8e': { scope: BuffScope.Account, type: BuffType.ExpeditionSlot, bonus: 3 }, // Slots d'expédition or - 7j
    'fd7d35e73d0e09e83e30812b738ef966ea9ef790': { scope: BuffScope.Account, type: BuffType.ExpeditionSlot, bonus: 3 }, // Slots d'expédition or - 30j
    '0684c6a5a42acbb3cd134913d421fc28dae6b90d': { scope: BuffScope.Account, type: BuffType.FleetSlot, bonus: 2 }, // Slots pour flottes bronze - 7j
    '94a28491b6fd85003f1cb151e88dde106f1d7596': { scope: BuffScope.Account, type: BuffType.FleetSlot, bonus: 2 }, // Slots pour flottes bronze - 30j
    'bb47add58876240199a18ddacc2db07789be1934': { scope: BuffScope.Account, type: BuffType.FleetSlot, bonus: 2 }, // Slots pour flottes bronze - 90j
    'a693c5ce3f5676efaaf0781d94234bea4f599d2e': { scope: BuffScope.Account, type: BuffType.FleetSlot, bonus: 4 }, // Slots pour flottes argent - 90j
    'c4e598a85805a7eb3ca70f9265cbd366fc4d2b0e': { scope: BuffScope.Account, type: BuffType.FleetSlot, bonus: 4 }, // Slots pour flottes argent - 30j
    'f8fd610825fb4a442e27e4e9add74f050e040e27': { scope: BuffScope.Account, type: BuffType.FleetSlot, bonus: 4 }, // Slots pour flottes argent - 7j
    '1808bf7639b81ac3ac87bcb7eb3bbba0a1874d0a': { scope: BuffScope.Account, type: BuffType.FleetSlot, bonus: 6 }, // Slots pour flottes or - 30j
    '1f7024c4f6493f0c589e1b00c76e6ced258c00e5': { scope: BuffScope.Account, type: BuffType.FleetSlot, bonus: 6 }, // Slots pour flottes or - 90j
    '5a8000c372cd079292a92d35d4ddba3c0f348d3b': { scope: BuffScope.Account, type: BuffType.FleetSlot, bonus: 6 }, // Slots pour flottes or - 7j
    '6f44dcd2bd84875527abba69158b4e976c308bbc': { scope: BuffScope.Planet, type: BuffType.MetalProduction, bonus: 0.2 }, // Booster de métal en argent - 90j
    '742743b3b0ae1f0b8a1e01921042810b58f12f39': { scope: BuffScope.Planet, type: BuffType.MetalProduction, bonus: 0.2 }, // Booster de métal en argent - 30j
    'ba85cc2b8a5d986bbfba6954e2164ef71af95d4a': { scope: BuffScope.Planet, type: BuffType.MetalProduction, bonus: 0.2 }, // Booster de métal en argent - 7j
    '05294270032e5dc968672425ab5611998c409166': { scope: BuffScope.Planet, type: BuffType.MetalProduction, bonus: 0.3 }, // Booster de métal en or - 7j
    '21c1a65ca6aecf54ffafb94c01d0c60d821b325d': { scope: BuffScope.Planet, type: BuffType.MetalProduction, bonus: 0.3 }, // Booster de métal en or - 90j
    '6fecb993169fe918d9c63cd37a2e541cc067664e': { scope: BuffScope.Planet, type: BuffType.MetalProduction, bonus: 0.3 }, // Booster de métal en or - 30j
    'a83cfdc15b8dba27c82962d57e50d8101d263cfb': { scope: BuffScope.Planet, type: BuffType.MetalProduction, bonus: 0.4 }, // Boosteur de métal en platine - 7j
    'c690f492cffe5f9f2952337e8eed307a8a62d6cf': { scope: BuffScope.Planet, type: BuffType.MetalProduction, bonus: 0.4 }, // Boosteur de métal en platine - 30j
    'ca7f903a65467b70411e513b0920d66c417aa3a2': { scope: BuffScope.Planet, type: BuffType.MetalProduction, bonus: 0.4 }, // Boosteur de métal en platine - 90j
    'be67e009a5894f19bbf3b0c9d9b072d49040a2cc': { scope: BuffScope.Moon, type: BuffType.MoonSlot, bonus: 2 }, // Extension lunaire en bronze - permanent
    'c21ff33ba8f0a7eadb6b7d1135763366f0c4b8bf': { scope: BuffScope.Moon, type: BuffType.MoonSlot, bonus: 4 }, // Extension lunaire en argent - permanent
    '05ee9654bd11a261f1ff0e5d0e49121b5e7e4401': { scope: BuffScope.Moon, type: BuffType.MoonSlot, bonus: 6 }, // Extension lunaire en or - permanent
    '8a426241572b2fea57844acd99bc326fe40e35cf': { scope: BuffScope.Moon, type: BuffType.MoonSlot, bonus: 8 }, // Extension lunaire en platine - permanent
    '16768164989dffd819a373613b5e1a52e226a5b0': { scope: BuffScope.Planet, type: BuffType.PlanetSlot, bonus: 4 }, // Extension planétaire en bronze - permanent
    '0e41524dc46225dca21c9119f2fb735fd7ea5cb3': { scope: BuffScope.Planet, type: BuffType.PlanetSlot, bonus: 9 }, // Extension planétaire en argent - permanent
    '04e58444d6d0beb57b3e998edc34c60f8318825a': { scope: BuffScope.Planet, type: BuffType.PlanetSlot, bonus: 15 }, // Extension planétaire en or - permanent
    'f3d9b82e10f2e969209c1a5ad7d22181c703bb36': { scope: BuffScope.Planet, type: BuffType.PlanetSlot, bonus: 20 }, // Extension planétaire en platine - permanent
} as const);