// Nạp quy định năm 2026 vào collection ruleSets.
// Đối chiếu lại lương tối thiểu và ngày lễ với nguồn chính thức trước khi dùng thật.
import { loadConfig } from '../src/config.ts';
import { connectMongo, getCollections, type RuleSetDoc } from '../src/db/client.ts';

const rules2026: RuleSetDoc = {
  _id: '2026',
  year: 2026,
  minimumWage: 10_320,
  weeklyHoliday: { minHours: 15, maxHours: 40, paidHours: 8 },
  holidays: [
    { date: '2026-01-01', name: 'Năm mới' },
    { date: '2026-02-16', name: 'Seollal' },
    { date: '2026-02-17', name: 'Seollal' },
    { date: '2026-02-18', name: 'Seollal' },
    { date: '2026-03-01', name: 'Ngày độc lập' },
    { date: '2026-03-02', name: 'Nghỉ bù' },
    { date: '2026-05-05', name: 'Ngày thiếu nhi' },
    { date: '2026-05-24', name: 'Phật đản' },
    { date: '2026-05-25', name: 'Nghỉ bù' },
    { date: '2026-06-03', name: 'Bầu cử địa phương' },
    { date: '2026-06-06', name: 'Ngày tưởng niệm' },
    { date: '2026-08-15', name: 'Ngày giải phóng' },
    { date: '2026-08-17', name: 'Nghỉ bù' },
    { date: '2026-09-24', name: 'Chuseok' },
    { date: '2026-09-25', name: 'Chuseok' },
    { date: '2026-09-26', name: 'Chuseok' },
    { date: '2026-10-03', name: 'Ngày lập quốc' },
    { date: '2026-10-05', name: 'Nghỉ bù' },
    { date: '2026-10-09', name: 'Ngày Hangul' },
    { date: '2026-12-25', name: 'Giáng sinh' },
  ],
  updatedAt: new Date(),
};

const config = loadConfig();
const { client, db } = await connectMongo(config.mongo.uri, config.mongo.db);
await getCollections(db).ruleSets.replaceOne({ _id: rules2026._id }, rules2026, { upsert: true });
console.log(`Đã nạp quy định năm ${rules2026.year}`);
await client.close();
