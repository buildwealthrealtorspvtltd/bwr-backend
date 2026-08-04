const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const path = require('path');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI missing in Server/.env');
  process.exit(1);
}

async function seedProductionData() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas');

    const usersCol = mongoose.connection.db.collection('users');
    const propertiesCol = mongoose.connection.db.collection('properties');

    // 1. Seed Admin User
    const adminEmail = 'admin@buildwealthrealtors.com';
    let adminUser = await usersCol.findOne({ email: adminEmail });

    if (!adminUser) {
      const hashedPassword = await bcrypt.hash('AdminPassword@2026', 10);
      const insertRes = await usersCol.insertOne({
        name: 'BWR Admin',
        email: adminEmail,
        password: hashedPassword,
        phone: '+919733567733',
        role: 'ADMIN',
        authProvider: 'LOCAL',
        isActive: true,
        isEmailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      adminUser = { _id: insertRes.insertedId };
      console.log('✅ Admin user created: admin@buildwealthrealtors.com / AdminPassword@2026');
    } else {
      console.log('ℹ️ Admin user already exists');
    }

    // 2. Seed Sample Approved Properties if DB is empty
    const propCount = await propertiesCol.countDocuments({ isDeleted: { $ne: true } });
    if (propCount === 0) {
      console.log('Seeding 3 initial approved properties...');
      const sampleProperties = [
        {
          title: 'Luxury 3 BHK Flat in Park Street, Kolkata',
          description: 'Spacious 3 BHK apartment with modern amenities, 24/7 security, covered parking, and prime connectivity.',
          category: 'RESIDENTIAL',
          listingType: 'SALE',
          propertyType: 'FLAT_APARTMENT',
          pricing: {
            totalPrice: 12500000,
            pricePerSqFt: 7352,
            isElectricityExtra: false,
          },
          specs: {
            bedrooms: 3,
            bathrooms: 3,
            balconies: 2,
            carpetAreaSqFt: 1700,
            superAreaSqFt: 1950,
            furnishingStatus: 'SEMI_FURNISHED',
            constructionStatus: 'READY_TO_MOVE',
            floorNumber: 5,
            totalFloors: 12,
            facing: 'EAST',
            servantQuarter: true,
          },
          location: {
            city: 'Kolkata',
            locality: 'Park Street',
            state: 'West Bengal',
            pincode: '700016',
          },
          amenities: ['Covered Parking', '24/7 Security', 'Power Backup', 'Elevator', 'Clubhouse'],
          media: {
            images: [
              'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
              'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
            ],
            videos: [],
          },
          status: 'APPROVED',
          isHotProperty: true,
          isFeatured: true,
          uploadedBy: adminUser._id,
          assignedAgent: adminUser._id,
          views: 42,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          title: 'Modern Commercial Office Space in Salt Lake Sector V',
          description: 'Fully fitted commercial IT office space near Metro Station with high-speed elevators and central AC.',
          category: 'COMMERCIAL',
          listingType: 'RENT',
          propertyType: 'OFFICE_SPACE',
          pricing: {
            monthlyRent: 85000,
            pricePerSqFtPerMonth: 85,
          },
          specs: {
            carpetAreaSqFt: 1000,
            superAreaSqFt: 1200,
            furnishingStatus: 'FULLY_FURNISHED',
            constructionStatus: 'READY_TO_MOVE',
            floorNumber: 8,
            totalFloors: 15,
          },
          location: {
            city: 'Kolkata',
            locality: 'Salt Lake Sector V',
            state: 'West Bengal',
            pincode: '700091',
          },
          amenities: ['Central Air Conditioning', 'Power Backup', '24/7 Access', 'Security Staff'],
          media: {
            images: [
              'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
            ],
          },
          status: 'APPROVED',
          isHotProperty: true,
          isFeatured: false,
          uploadedBy: adminUser._id,
          assignedAgent: adminUser._id,
          views: 18,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          title: 'Premium Residential Land Plot in New Town Action Area 1',
          description: 'Corner plot ideal for bungalow or villa construction in a rapidly developing gated township.',
          category: 'LAND_PLOT',
          listingType: 'SALE',
          propertyType: 'RESIDENTIAL_PLOT',
          pricing: {
            totalPrice: 8500000,
            pricePerKattha: 2833333,
          },
          specs: {
            plotAreaKattha: 3,
            plotAreaSqFt: 2160,
          },
          location: {
            city: 'Kolkata',
            locality: 'New Town Action Area 1',
            state: 'West Bengal',
            pincode: '700156',
          },
          amenities: ['Gated Community', 'Wide Road Access', 'Street Lights'],
          media: {
            images: [
              'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
            ],
          },
          status: 'APPROVED',
          isHotProperty: false,
          isFeatured: true,
          uploadedBy: adminUser._id,
          assignedAgent: adminUser._id,
          views: 29,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await propertiesCol.insertMany(sampleProperties);
      console.log('✅ 3 initial approved properties seeded into MongoDB Atlas!');
    } else {
      console.log('ℹ️ Properties already exist in MongoDB Atlas');
    }
  } catch (err) {
    console.error('❌ Seeding error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB Atlas.');
  }
}

seedProductionData();
