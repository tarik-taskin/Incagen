import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, getDoc, doc } from "firebase/firestore";
import { getStorage, getBytes, ref } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";
const require = createRequire(new URL("../functions/package.json", import.meta.url));
const ExcelJS = require("exceljs");
const JSZip = require("jszip");
const { PDFDocument, StandardFonts } = require("pdf-lib");

// Test dosyaları yalnız sentetik, küçük ve aynı beklenen sayıları taşıyan belgelerdir.
async function fixtures() {
  const pdf = await PDFDocument.create(); const page = pdf.addPage();
  page.drawText("Synthetic acceptance: revenue 350 TRY, costs 100 TRY.", { x: 40, y: 700, size: 12, font: await pdf.embedFont(StandardFonts.Helvetica) });
  const word = new JSZip();
  word.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  word.file("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  word.file("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Synthetic acceptance. Revenue 350 TRY; costs 100 TRY.</w:t></w:r></w:p></w:body></w:document>');
  const book = new ExcelJS.Workbook(); const sheet = book.addWorksheet("Sales");
  sheet.addRows([["item", "amount"], ["A", 100], ["B", 250]]);
  return [
    { name: "acceptance.pdf", mimeType: "application/pdf", buffer: Buffer.from(await pdf.save()) },
    { name: "acceptance.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: await word.generateAsync({ type: "nodebuffer" }) },
    { name: "acceptance.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(await book.xlsx.writeBuffer()) },
  ];
}

// Yalnız doğrulanan canlı proje ve açıkça verilen Netlify/localhost URL'si hedeflenebilir.
function configuration() {
  if (process.env.INCAGEN_CLOUD_ACCEPTANCE !== "1") throw new Error("Live acceptance requires explicit opt-in.");
  const url = new URL(process.env.INCAGEN_ACCEPTANCE_URL ?? "");
  if (!((url.protocol === "https:" && (url.hostname === "incagen.netlify.app" || /^[a-f0-9]+--incagen\.netlify\.app$/.test(url.hostname))) || (url.protocol === "http:" && url.hostname === "127.0.0.1"))) throw new Error("Unexpected acceptance URL.");
  const values = Object.fromEntries(readFileSync(".env.cloud-preview.local", "utf8").split(/\r?\n/).filter(line => /^VITE_FIREBASE_/.test(line)).map(line => { const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, "")]; }));
  if (values.VITE_FIREBASE_PROJECT_ID !== "incagen-eeef4") throw new Error("Unexpected Firebase project.");
  return { apiKey: values.VITE_FIREBASE_API_KEY, authDomain: values.VITE_FIREBASE_AUTH_DOMAIN, projectId: values.VITE_FIREBASE_PROJECT_ID, storageBucket: values.VITE_FIREBASE_STORAGE_BUCKET, appId: values.VITE_FIREBASE_APP_ID };
}

test("canlı sitede PDF/Word/Excel hazırlama, geçmiş, izolasyon ve kaynak silme", async ({ page }) => {
  const config = configuration();
  const nonce = randomUUID(); const email = `acceptance-${nonce}@example.test`; const password = `Synthetic-${randomUUID()}!`;
  const own = initializeApp(config, `acceptance-own-${nonce}`); const other = initializeApp(config, `acceptance-other-${nonce}`);
  const accounts = [{ app: own, email, password }, { app: other, email: `acceptance-other-${nonce}@example.test`, password: `Synthetic-${randomUUID()}!` }];
  let createdInBrowser = false;
  const cleanupErrors: string[] = [];
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "Analize başla", exact: true }).click();
    await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
    await page.getByLabel("E-posta", { exact: true }).fill(email);
    await page.getByLabel("Parola", { exact: true }).fill(password);
    await page.getByLabel("Parola tekrarı", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Hesap oluştur", exact: true }).click();
    createdInBrowser = true;
    await expect(page).toHaveURL(/\/app\/new-analysis$/);
    const ownAuth = getAuth(own); await signInWithEmailAndPassword(ownAuth, email, password);
    await expect(httpsCallable(getFunctions(own, "europe-west1"), "checkGemini")({})).rejects.toMatchObject({ code: "functions/permission-denied" });
    const otherAuth = getAuth(other); await createUserWithEmailAndPassword(otherAuth, accounts[1].email, accounts[1].password);
    await page.getByLabel("İşletme adı", { exact: true }).fill("Synthetic acceptance");
    await page.getByLabel("Analiz başlığı", { exact: true }).fill("Cloud acceptance PDF Word Excel");
    await page.getByLabel("Analiz hedefi", { exact: true }).fill("Compare the revenue information across all three source documents.");
    await page.locator('input[type="file"]').setInputFiles(await fixtures());
    await page.getByRole("button", { name: "Belgeleri ayrıştır", exact: true }).click();
    await expect(page.getByText("Analize hazır", { exact: true })).toBeVisible({ timeout: 90_000 });
    const id = new URL(page.url()).pathname.split("/").at(-1)!;
    expect(id).toMatch(/^[a-f0-9-]{36}$/);
    const recordPath = `users/${ownAuth.currentUser!.uid}/analyses/${id}`;
    console.log("Cloud preparation completed for PDF, DOCX and XLSX.");
    const record = (await getDoc(doc(getFirestore(own), recordPath))).data()!;
    expect(record.status).toBe("completed"); expect(record.report.fileCount).toBe(3);
    expect(record.report.sources.map((source: { detectedMime: string }) => source.detectedMime).sort()).toEqual((await fixtures()).map(file => file.mimeType).sort());
    await expect(getDoc(doc(getFirestore(other), recordPath))).rejects.toMatchObject({ code: "permission-denied" });
    await expect(getBytes(ref(getStorage(other), `${recordPath}/file-0`))).rejects.toMatchObject({ code: "storage/unauthorized" });
    await expect(httpsCallable(getFunctions(other, "europe-west1"), "prepareAnalysis")({ id })).rejects.toMatchObject({ code: "functions/not-found" });
    console.log("Cross-account read, download and prepare denied.");
    writeFileSync("/tmp/incagen-cloud-acceptance-resources.json", JSON.stringify({ uid: ownAuth.currentUser!.uid, otherUid: otherAuth.currentUser!.uid, analysisId: id, recordPath, attempt: record.artifactAttempt }));
    await page.goto("/app/history");
    await expect(page.getByRole("list", { name: "Analiz geçmişi" }).getByRole("listitem")).toHaveCount(1);
    await page.reload();
    await page.getByRole("link", { name: /Cloud acceptance PDF Word Excel/ }).click();
    await expect(page).toHaveURL(new RegExp(`/app/analyses/${id}$`));
    await expect(page.getByRole("heading", { name: "Cloud acceptance PDF Word Excel", exact: true })).toBeVisible();
    await page.screenshot({ path: "/tmp/incagen-cloud-preparation-accepted.png", fullPage: true });
    await page.goto("/app/history");
    await page.getByRole("button", { name: "Cloud acceptance PDF Word Excel için diğer işlemler" }).click();
    await page.getByLabel("Cloud acceptance PDF Word Excel işlemleri").getByRole("button", { name: "Analizi sil", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Analizi sil", exact: true }).click();
    await expect(page.getByRole("heading", { name: "İlk çalışmanız burada yerini alsın.", exact: true })).toBeVisible();
    expect((await getDoc(doc(getFirestore(own), recordPath))).exists()).toBe(false);
    for (let index = 0; index < 3; index++) await expect(getBytes(ref(getStorage(own), `${recordPath}/file-${index}`))).rejects.toMatchObject({ code: "storage/object-not-found" });
    console.log("Live acceptance: 3 source formats, reload/history, cross-user denial and source deletion passed.");
  } finally {
    // Yalnız bu testte oluşturulan UUID e-postalarına yeniden girilir; mevcut kullanıcı hesapları silinmez.
    for (const account of accounts) {
      try {
        if (account.app === own && !createdInBrowser) continue;
        await signInWithEmailAndPassword(getAuth(account.app), account.email, account.password);
        await httpsCallable(getFunctions(account.app, "europe-west1"), "deleteAccount")({ confirmation: "HESABIMI SİL" });
      } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && ["auth/invalid-credential", "auth/user-not-found"].includes(String(error.code)))) { cleanupErrors.push(String("code" in error ? error.code : "unknown")); console.error("Synthetic cleanup failed; inspect acceptance resources."); }
      } finally { await deleteApp(account.app); }
    }
  }
  expect(cleanupErrors).toEqual([]);
});
