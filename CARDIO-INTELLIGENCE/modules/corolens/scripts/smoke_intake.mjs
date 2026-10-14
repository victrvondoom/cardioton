// One live TypeSafe call on a hand-written note (reads TYPESAFE_API_KEY from the environment).
import { extract } from "../web/intake_core.js";
const note = `62 y/o man referred for exertional chest pressure relieved by rest (typical angina), NYHA class II.
Hypertensive on amlodipine 5 mg, type 2 diabetic, quit smoking 2019. BP 150/90, pulse 78.
Labs: FBS 132, creatinine 1.1, TG 210, LDL 145, HDL 34, Hb 14.2, Na 140, K 4.4.
ECG: ST depression in V4-V6, no Q waves. Echo: EF 45%, RWMA in 2 regions, mild MR. Follow-up in 2 weeks.`;
const out = await extract(note, { apiKey: process.env.TYPESAFE_API_KEY });
console.log(JSON.stringify({ model: out.model, usage: out.usage, record: out.record }, null, 1));
