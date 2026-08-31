/**
 * GooseFocus - Goose Wardrobe, Fitting Room & Farm Shop Catalog
 */

import { soundEngine } from './audio.js';
import { store } from './storage.js';

export const SHOP_CATALOG = {
  hats: [
    { id: 'none', name: 'ไม่ใส่หมวก', icon: '❌', price: 0, desc: 'ห่านเรียบง่ายสไตล์มินิมอล' },
    { id: 'straw_hat', name: 'หมวกฟางชาวสวน', icon: '🌾', price: 0, desc: 'หมวกฟางกันแดดยอดนิยมของชาวไร่' },
    { id: 'wizard_hat', name: 'หมวกพ่อมดมนตรา', icon: '🧙‍♂️', price: 60, desc: 'หมวกเวทมนตร์เสกขนนกทองคำ' },
    { id: 'crown', name: 'มงกุฎทองคำจักรพรรดิ', icon: '👑', price: 120, desc: 'มงกุฎประดับอัญมณีของราชาห่าน' },
    { id: 'space_helmet', name: 'หมวกนักบินอวกาศ', icon: '🚀', price: 150, desc: 'เตรียมพร้อมสำรวจดวงดาว Galaxy' },
    { id: 'chef_hat', name: 'หมวกเชฟกระทะห่าน', icon: '🍳', price: 50, desc: 'ปรุงอาหารสูตรเด็ดให้เพื่อนในฟาร์ม' }
  ],
  accessories: [
    { id: 'none', name: 'ไม่มีเครื่องประดับ', icon: '❌', price: 0, desc: 'ใบหน้าธรรมชาติของเจ้าห่าน' },
    { id: 'sunglasses', name: 'แว่นตากันแดดสุดคูล', icon: '😎', price: 40, desc: 'เท่จัดจนแสงแดดต้องหลบทางให้' },
    { id: 'monocle', name: 'แว่นตาเดี่ยวนักสืบ', icon: '🧐', price: 55, desc: 'เพิ่มสมาธิในการอ่านหนังสือและวิจัย' },
    { id: 'scarf', name: 'ผ้าพันคอไหมพรมสีแดง', icon: '🧣', price: 45, desc: 'อบอุ่นในวันที่ฝนตกหรือลมหนาว' },
    { id: 'halo', name: 'วงแหวนเทวทูตเรืองแสง', icon: '😇', price: 80, desc: 'พลังแห่งความสงบนิ่งบริสุทธิ์' }
  ],
  skins: [
    { id: 'classic_white', name: 'ห่านขาวคลาสสิก', icon: '🪿', price: 0, desc: 'เจ้าห่านสีขาวขนปุยคู่ใจ' },
    { id: 'golden_honk', name: 'ห่านทองคำเปล่งประกาย', icon: '✨🪿', price: 200, desc: 'ตำนานห่านออกไข่เป็นทองคำ' },
    { id: 'cosmic_deity', name: 'ห่านเทพเจ้าคอสมิก', icon: '🌌🪿', price: 300, desc: 'พลังจักรวาลลอยล่องในห้วงอวกาศ' },
    { id: 'ninja_black', name: 'ห่านนินจาเงาทมิฬ', icon: '🥷🪿', price: 150, desc: 'เคลื่อนไหวดั่งสายลมเงียบกริบ' }
  ],
  decor: [
    { id: 'flower_bed', name: 'แปลงดอกทิวลิปหลากสี', icon: '🌷', price: 30, desc: 'เพิ่มความสดชื่นริมสระน้ำ' },
    { id: 'firefly_lantern', name: 'โคมไฟหิ่งห้อยโบราณ', icon: '🏮', price: 70, desc: 'ส่องแสงสว่างนวลตาในยามค่ำคืน' },
    { id: 'campfire', name: 'กองไฟแคมป์ปิ้งอบอุ่น', icon: '🔥', price: 100, desc: 'นั่งล้อมวงกินมาร์ชเมลโลว์' },
    { id: 'statue', name: 'อนุสาวรีย์ห่านทองคำ', icon: '🗽', price: 250, desc: 'เกียรติยศสูงสุดแห่งฟาร์ม' }
  ]
};

export class ShopManager {
  constructor(onEquipChangeCallback) {
    this.onEquipChange = onEquipChangeCallback;
    this.currentCategory = 'hats';
    this.fittingGoose = { ...store.get().activeGoose };
  }

  renderFittingRoom() {
    const container = document.getElementById('fittingGooseWrapper');
    if (!container) return;

    const goose = this.fittingGoose;

    // Skin Colors
    let bodyFill = '#ffffff';
    let wingFill = '#e2e8f0';
    let beakFill = '#f59e0b';

    if (goose.skin === 'golden_honk') {
      bodyFill = '#fef08a';
      wingFill = '#fbbf24';
      beakFill = '#d97706';
    } else if (goose.skin === 'cosmic_deity') {
      bodyFill = '#e0e7ff';
      wingFill = '#818cf8';
      beakFill = '#c084fc';
    } else if (goose.skin === 'ninja_black') {
      bodyFill = '#334155';
      wingFill = '#1e293b';
      beakFill = '#f97316';
    }

    // Accessories SVG Overlays
    let hatSvg = '';
    if (goose.hat === 'straw_hat') {
      hatSvg = `
        <!-- Straw Hat -->
        <ellipse cx="68" cy="22" rx="20" ry="7" fill="#fde047"/>
        <rect x="58" y="10" width="20" height="12" rx="3" fill="#fde047"/>
        <rect x="58" y="18" width="20" height="4" fill="#dc2626"/>
      `;
    } else if (goose.hat === 'wizard_hat') {
      hatSvg = `
        <!-- Wizard Hat -->
        <ellipse cx="68" cy="24" rx="22" ry="7" fill="#6366f1"/>
        <polygon points="52,24 84,24 72,-6" fill="#6366f1"/>
        <polygon points="68,-4 76,-4 72,-10" fill="#fbbf24"/>
      `;
    } else if (goose.hat === 'crown') {
      hatSvg = `
        <!-- Gold Crown -->
        <polygon points="56,22 54,8 62,15 68,4 74,15 82,8 80,22" fill="#fbbf24"/>
        <circle cx="54" cy="8" r="2" fill="#ef4444"/>
        <circle cx="68" cy="4" r="2" fill="#3b82f6"/>
        <circle cx="82" cy="8" r="2" fill="#10b981"/>
      `;
    } else if (goose.hat === 'space_helmet') {
      hatSvg = `
        <!-- Space Helmet -->
        <circle cx="68" cy="26" r="22" fill="none" stroke="#e2e8f0" stroke-width="4"/>
        <ellipse cx="72" cy="26" rx="14" ry="16" fill="rgba(56, 189, 248, 0.45)"/>
      `;
    }

    let glassesSvg = '';
    if (goose.glasses === 'sunglasses') {
      glassesSvg = `
        <!-- Sunglasses -->
        <rect x="64" y="24" width="18" height="8" rx="2" fill="#0f172a"/>
        <line x1="60" y1="26" x2="64" y2="26" stroke="#0f172a" stroke-width="2"/>
        <line x1="66" y1="26" x2="70" y2="30" stroke="#ffffff" stroke-width="1.5"/>
      `;
    } else if (goose.glasses === 'monocle') {
      glassesSvg = `
        <!-- Monocle -->
        <circle cx="70" cy="27" r="7" fill="rgba(56, 189, 248, 0.3)" stroke="#fbbf24" stroke-width="2"/>
        <path d="M 70 34 Q 66 44 60 50" stroke="#fbbf24" stroke-width="1.5" fill="none"/>
      `;
    }

    container.innerHTML = `
      <svg viewBox="0 0 120 120" style="width: 100%; height: 100%;">
        <!-- Shadow -->
        <ellipse cx="60" cy="104" rx="36" ry="12" fill="rgba(0,0,0,0.12)"/>
        
        <!-- Feet -->
        <polygon points="46,92 40,102 52,102" fill="#ea580c"/>
        <polygon points="66,92 60,102 72,102" fill="#ea580c"/>

        <!-- Body -->
        <ellipse cx="56" cy="74" rx="28" ry="20" fill="${bodyFill}"/>
        <!-- Tail -->
        <path d="M 28 68 Q 16 60 20 74 Q 26 78 32 76 Z" fill="${bodyFill}"/>
        <!-- Wing -->
        <ellipse cx="50" cy="72" rx="16" ry="10" fill="${wingFill}"/>

        <!-- Neck & Head -->
        <path d="M 68 72 Q 78 54 74 32 Q 72 20 80 20 Q 86 20 86 34 Q 82 58 72 74 Z" fill="${bodyFill}"/>
        
        <!-- Beak -->
        <polygon points="80,24 100,28 80,34" fill="${beakFill}"/>
        <!-- Eye -->
        <circle cx="76" cy="26" r="2.5" fill="#0f172a"/>
        <circle cx="77" cy="25" r="0.8" fill="#ffffff"/>

        <!-- Overlaid Hat -->
        ${hatSvg}

        <!-- Overlaid Glasses -->
        ${glassesSvg}
      </svg>
    `;

    // Update labels
    const hatItem = SHOP_CATALOG.hats.find(h => h.id === goose.hat);
    const glassesItem = SHOP_CATALOG.accessories.find(a => a.id === goose.glasses);
    const skinItem = SHOP_CATALOG.skins.find(s => s.id === goose.skin);

    const slotHatName = document.getElementById('slotHatName');
    const slotGlassesName = document.getElementById('slotGlassesName');
    const slotSkinName = document.getElementById('slotSkinName');
    if (slotHatName) slotHatName.textContent = hatItem ? hatItem.name : 'ไม่มี';
    if (slotGlassesName) slotGlassesName.textContent = glassesItem ? glassesItem.name : 'ไม่มี';
    if (slotSkinName) slotSkinName.textContent = skinItem ? skinItem.name : 'คลาสสิก';

    const gooseInput = document.getElementById('gooseCustomNameInput');
    if (gooseInput && document.activeElement !== gooseInput) {
      gooseInput.value = goose.name;
    }
  }

  renderShop(category = 'hats') {
    this.currentCategory = category;
    const container = document.getElementById('shopItemsGrid');
    const balanceEl = document.getElementById('shopBalanceFeathers');
    if (!container) return;

    const state = store.get();
    if (balanceEl) {
      balanceEl.textContent = `${state.farmer.feathers} 🪶`;
    }

    const items = SHOP_CATALOG[category] || [];
    const ownedList = state.inventory[category] || ['none'];
    const activeEquip = category === 'hats' ? this.fittingGoose.hat : 
                        (category === 'accessories' ? this.fittingGoose.glasses : 
                        (category === 'skins' ? this.fittingGoose.skin : ''));

    container.innerHTML = items.map(item => {
      const isOwned = ownedList.includes(item.id);
      const isEquipped = activeEquip === item.id;
      const canAfford = state.farmer.feathers >= item.price;

      let btnHtml = '';
      if (isEquipped) {
        btnHtml = `<button class="shop-item-btn btn-equipped">✓ กำลังสวม</button>`;
      } else if (isOwned) {
        btnHtml = `<button class="shop-item-btn btn-equip" data-action="equip" data-cat="${category}" data-id="${item.id}">ลองสวมใส่</button>`;
      } else {
        btnHtml = `<button class="shop-item-btn btn-buy ${canAfford ? '' : 'opacity-50'}" data-action="buy" data-cat="${category}" data-id="${item.id}">ซื้อ ${item.price} 🪶</button>`;
      }

      return `
        <div class="shop-item-card">
          <div class="shop-item-icon-box">${item.icon}</div>
          <div class="shop-item-name">${item.name}</div>
          <div class="shop-item-desc">${item.desc}</div>
          ${btnHtml}
        </div>
      `;
    }).join('');
  }

  handleItemAction(action, cat, itemId) {
    const state = store.get();
    const item = (SHOP_CATALOG[cat] || []).find(i => i.id === itemId);
    if (!item) return;

    if (action === 'buy') {
      if (state.farmer.feathers >= item.price) {
        soundEngine.playFanfare();
        store.update(s => {
          s.farmer.feathers -= item.price;
          if (!s.inventory[cat]) s.inventory[cat] = [];
          s.inventory[cat].push(itemId);
        });
        this.equipItem(cat, itemId);
        this.renderShop(this.currentCategory);
        this.renderFittingRoom();
      } else {
        soundEngine.playClick();
        alert('ขนนกทองคำ (🪶) ไม่เพียงพอ! ตั้งใจโฟกัสเพื่อเก็บเกี่ยวเพิ่มนะ!');
      }
    } else if (action === 'equip') {
      soundEngine.playClick();
      this.equipItem(cat, itemId);
      this.renderShop(this.currentCategory);
      this.renderFittingRoom();
    }
  }

  equipItem(cat, itemId) {
    if (cat === 'hats') {
      this.fittingGoose.hat = itemId;
    } else if (cat === 'accessories') {
      this.fittingGoose.glasses = itemId;
    } else if (cat === 'skins') {
      this.fittingGoose.skin = itemId;
    }
  }

  applyToFarm() {
    soundEngine.playHonk(1.1);
    store.update(s => {
      s.activeGoose = { ...this.fittingGoose };
      // Update first goose in farm list
      if (s.geeseList && s.geeseList.length > 0) {
        s.geeseList[0].hat = this.fittingGoose.hat;
        s.geeseList[0].glasses = this.fittingGoose.glasses;
        s.geeseList[0].skin = this.fittingGoose.skin;
        s.geeseList[0].name = this.fittingGoose.name;
      }
    });

    if (this.onEquipChange) {
      this.onEquipChange();
    }
  }
}
