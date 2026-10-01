const { Product, slugify } = require('./app');
const { log } = require('./lib');

const img = (seed) => [
  `https://picsum.photos/seed/${seed}/600/600`,
  `https://picsum.photos/seed/${seed}-2/600/600`,
];

// [name, brand, category, price, mrp, stock, rating, ratingCount, featured, highlights]
const CATALOG = [
  ['Galaxy S25 Ultra (Titanium Black, 256 GB)', 'Samsung', 'Mobiles', 124999, 134999, 40, 4.6, 18234, true, ['12 GB RAM', '6.9" QHD+ Display', '200MP Camera', '5000 mAh Battery']],
  ['iPhone 16 (Ultramarine, 128 GB)', 'Apple', 'Mobiles', 74900, 79900, 60, 4.7, 52310, true, ['A18 Chip', '6.1" Super Retina XDR', '48MP Fusion Camera', 'Action Button']],
  ['Pixel 9 (Obsidian, 128 GB)', 'Google', 'Mobiles', 69999, 79999, 25, 4.5, 6120, false, ['12 GB RAM', 'Tensor G4', '50MP Dual Camera', '7 years of updates']],
  ['Nord CE4 5G (Celadon Marble, 128 GB)', 'OnePlus', 'Mobiles', 22999, 26999, 120, 4.4, 30411, false, ['8 GB RAM', '120Hz AMOLED', '100W SUPERVOOC', '5500 mAh Battery']],
  ['Redmi Note 14 Pro (Aurora Purple, 256 GB)', 'Xiaomi', 'Mobiles', 25999, 31999, 90, 4.3, 14520, false, ['8 GB RAM', '1.5K AMOLED', '200MP Camera', 'IP68']],
  ['MacBook Air M3 (13-inch, 16 GB, 512 GB)', 'Apple', 'Electronics', 134900, 144900, 15, 4.8, 3420, true, ['Apple M3 Chip', '18 hr Battery', 'Liquid Retina Display', '1.24 kg']],
  ['IdeaPad Slim 5 (Ryzen 7, 16 GB, 512 GB SSD)', 'Lenovo', 'Electronics', 62990, 82390, 30, 4.4, 2891, false, ['AMD Ryzen 7 8845HS', '14" WUXGA OLED', 'Backlit Keyboard', 'Windows 11']],
  ['WH-1000XM5 Wireless Noise Cancelling Headphones', 'Sony', 'Electronics', 26990, 34990, 50, 4.6, 11200, true, ['Industry-leading ANC', '30 hr Battery', 'Multipoint', 'Speak-to-Chat']],
  ['Airdopes 141 Bluetooth TWS Earbuds', 'boAt', 'Electronics', 1099, 4490, 300, 4.1, 410230, false, ['42 hr Playback', 'ENx Noise Cancellation', 'IPX4', 'BEAST Mode']],
  ['Smart Watch Fit 3 (AMOLED, Bluetooth Calling)', 'Noise', 'Electronics', 2499, 6999, 200, 4.0, 88120, false, ['1.96" AMOLED', 'BT Calling', '100+ Sports Modes', '7 day battery']],
  ['55" 4K Ultra HD Smart Google TV', 'Sony', 'Electronics', 57990, 99900, 20, 4.6, 7840, true, ['4K HDR Processor X1', 'Dolby Audio', 'Google TV', '3 HDMI ports']],
  ['EOS R50 Mirrorless Camera with 18-45mm Lens', 'Canon', 'Electronics', 64990, 75995, 12, 4.5, 1210, false, ['24.2 MP APS-C', '4K 30p Video', 'Dual Pixel AF II', 'Vari-angle Screen']],
  ['Men Slim Fit Solid Casual Shirt', 'Roadster', 'Fashion', 599, 1799, 500, 4.0, 21430, false, ['100% Cotton', 'Slim Fit', 'Machine Wash', 'Full Sleeve']],
  ['Women Floral Print A-Line Kurta', 'Libas', 'Fashion', 899, 2499, 350, 4.2, 15820, true, ['Viscose Rayon', 'Calf Length', '3/4 Sleeve', 'Round Neck']],
  ['Men Revolution 7 Running Shoes', 'Nike', 'Fashion', 3695, 4495, 140, 4.4, 9230, true, ['Mesh Upper', 'Foam Midsole', 'Rubber Outsole', 'Lace-up']],
  ['Unisex Classic Aviator Sunglasses', 'Ray-Ban', 'Fashion', 8490, 9990, 70, 4.5, 4310, false, ['UV Protection', 'Metal Frame', 'Polarized', 'Medium Size']],
  ['Men Regular Fit Mid-Rise Jeans', "Levi's", 'Fashion', 1799, 3599, 260, 4.3, 18760, false, ['Stretchable Denim', 'Regular Fit', '5 Pocket', 'Dark Blue']],
  ['Analog Watch with Leather Strap', 'Fossil', 'Fashion', 7995, 11995, 45, 4.4, 2670, false, ['Mineral Crystal', '5 ATM Water Resistant', 'Chronograph', '2 Year Warranty']],
  ['Non-Stick Cookware Set (3 Pieces)', 'Prestige', 'Home & Kitchen', 1899, 3495, 150, 4.2, 12840, false, ['Granite Finish', 'Induction Base', 'PFOA Free', 'Glass Lid']],
  ['Double Bed Cotton Bedsheet with 2 Pillow Covers', 'Bombay Dyeing', 'Home & Kitchen', 749, 1999, 400, 4.1, 30120, false, ['144 TC', '100% Cotton', 'King Size', 'Floral Print']],
  ['Mixer Grinder 750W (3 Jars)', 'Philips', 'Home & Kitchen', 3499, 5995, 90, 4.3, 22100, true, ['750 W Motor', '3 Stainless Steel Jars', 'Overload Protection', '2 Year Warranty']],
  ['Engineered Wood Study Table', 'Wakefit', 'Home & Kitchen', 5499, 10999, 35, 4.2, 3820, false, ['Matte Finish', 'Cable Management', 'Storage Shelf', 'DIY Assembly']],
  ['1.5 Ton 5 Star Inverter Split AC', 'LG', 'Appliances', 44990, 75990, 18, 4.4, 6720, true, ['5 Star BEE Rating', 'AI Convertible 6-in-1', 'Copper Condenser', 'HD Filter']],
  ['7 kg Fully Automatic Front Load Washing Machine', 'Samsung', 'Appliances', 29990, 41500, 22, 4.5, 9180, false, ['Eco Bubble', 'Hygiene Steam', 'Digital Inverter', '1200 RPM']],
  ['253 L Frost Free Double Door Refrigerator', 'Whirlpool', 'Appliances', 24490, 31800, 25, 4.3, 7460, false, ['3 Star', 'Convertible Freezer', 'Inverter Compressor', 'Toughened Glass Shelves']],
  ['Robot Vacuum Cleaner with Mop', 'Eureka Forbes', 'Appliances', 15999, 29999, 30, 4.0, 2140, false, ['Lidar Navigation', 'App Control', '2-in-1 Mop', '150 min Runtime']],
  ['Atomic Habits', 'Penguin', 'Books', 399, 799, 600, 4.7, 98220, true, ['Paperback', 'James Clear', 'Self-Help', 'English']],
  ['The Psychology of Money', 'Jaico', 'Books', 299, 399, 500, 4.6, 71300, false, ['Paperback', 'Morgan Housel', 'Finance', 'English']],
  ['Designing Data-Intensive Applications', "O'Reilly", 'Books', 1599, 2400, 80, 4.8, 5420, false, ['Paperback', 'Martin Kleppmann', 'Computer Science', 'English']],
  ['Kubernetes Up & Running (3rd Edition)', "O'Reilly", 'Books', 1299, 1950, 70, 4.6, 1830, false, ['Paperback', 'Burns, Beda, Hightower', 'DevOps', 'English']],
  ['Vitamin C Face Serum 30 ml', 'Minimalist', 'Beauty', 545, 599, 400, 4.2, 40210, false, ['10% Vitamin C', 'For Glowing Skin', 'Fragrance Free', 'All Skin Types']],
  ['Matte Liquid Lipstick (Set of 3)', 'Maybelline', 'Beauty', 799, 1497, 220, 4.3, 18760, false, ['16 hr Wear', 'Transfer Proof', 'Matte Finish', 'Vegan']],
  ['Hair Dryer 1600W with Cool Shot', 'Philips', 'Beauty', 1399, 2195, 160, 4.2, 25110, false, ['1600 W', 'ThermoProtect', '3 Heat Settings', 'Foldable']],
  ['Kashmir Willow Cricket Bat', 'SG', 'Sports', 1999, 3299, 80, 4.1, 3410, false, ['Kashmir Willow', 'Full Size', 'Cane Handle', 'With Cover']],
  ['Yoga Mat 6mm Anti-Slip', 'Boldfit', 'Sports', 499, 1499, 450, 4.2, 54210, false, ['6 mm TPE', 'Anti-Slip', 'Carry Strap', 'Lightweight']],
  ['Adjustable Dumbbells 20 kg Set', 'Kore', 'Sports', 2299, 4999, 60, 4.0, 8920, false, ['PVC Plates', 'Steel Rods', 'Home Gym', '20 kg Total']],
  ['Hybrid Cycle 21 Speed (700C)', 'Hercules', 'Sports', 13999, 18999, 15, 4.3, 1260, true, ['21 Shimano Gears', 'Disc Brakes', 'Alloy Frame', 'Front Suspension']],
  ['PlayStation 5 Slim Console', 'Sony', 'Gaming', 49990, 54990, 10, 4.8, 9340, true, ['1 TB SSD', '4K 120Hz', 'DualSense Controller', 'Ray Tracing']],
  ['Xbox Wireless Controller (Carbon Black)', 'Microsoft', 'Gaming', 4890, 5990, 90, 4.6, 7240, false, ['Bluetooth', 'Textured Grip', 'Share Button', 'PC & Xbox']],
  ['Mechanical Gaming Keyboard (RGB, Blue Switches)', 'Redragon', 'Gaming', 2899, 4999, 110, 4.3, 12030, false, ['Blue Switches', 'Per-key RGB', 'Anti-ghosting', 'Detachable Cable']],
];

async function seedProducts() {
  if ((await Product.estimatedDocumentCount()) > 0) return;
  const docs = CATALOG.map(([name, brand, category, price, mrp, stock, rating, ratingCount, isFeatured, highlights]) => {
    const slug = slugify(name);
    return {
      name,
      slug,
      brand,
      category,
      price,
      mrp,
      stock,
      rating,
      ratingCount,
      isFeatured,
      highlights,
      images: img(slug),
      description: `${name} by ${brand}. ${highlights.join(' • ')}. Genuine product with brand warranty, easy returns and fast delivery from ShopVerse.`,
    };
  });
  await Product.insertMany(docs, { ordered: false });
  log('info', `seeded ${docs.length} products`);
}

module.exports = { seedProducts, CATALOG };
