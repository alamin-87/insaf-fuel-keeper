import { MongoClient } from "mongodb";

async function main() {
  const uri = "mongodb+srv://anikwitinstitute_db_user:anikwitinstitutegmailcom@d360crm.s0ebokd.mongodb.net/?appName=D360CRM";
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("insaf_gas_corp");
  
  const collections = ["accounts", "chartOfAccounts", "assets"];
  for (const c of collections) {
    try {
      await db.collection(c).drop();
      console.log("Dropped", c);
    } catch (e) {
      console.log("Collection", c, "does not exist or could not be dropped");
    }
  }
  
  await client.close();
  console.log("Done");
}

main();
