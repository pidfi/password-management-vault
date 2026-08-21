function checkWebsites() {
  let spreadsheet = SpreadsheetApp.getActive();
  let sheet = spreadsheet.getSheetByName('hash_checker');

  const rowNumber = 2;
  const url = "YOUR_WEBSITE_URL_THAT_SERVES_THE_HOSTED_HASH_CHECKER";
  const oldHash = "YOUR_TRUSTED_HASH_OF_HOSTED_HASH_CHECKER"; // if unchanged: 042d9c9ac9ae8a72614b54a488dccf19ca48e3cddf41124008becc99d1d7fce0

  try {
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true
    });

    const bytes = response.getContent();
    const newHash = sha256Bytes(bytes);
    const now = new Date();
    const now_your_timezone = Utilities.formatDate(
      now,
      "YOUR_TIMEZONE_STRING",
      "yyyy-MM-dd HH:mm:ss"
    );


    // hash and time of last check
    sheet.getRange(rowNumber, 1).setValue(newHash);
    sheet.getRange(rowNumber, 2).setValue(now_your_timezone);

    // no change detected
    if (oldHash === newHash) {
      sheet.getRange(rowNumber, 3).setValue("OK");
      return;
    }

    // change detected
    sheet.getRange(rowNumber, 3).setValue("⚠️ CHANGED");

  } catch (error) {
    sheet.getRange(rowNumber, 2).setValue(new Date());
    sheet.getRange(rowNumber, 3).setValue(
      "❌ ERROR: " + error.message
    );
  }
}


function sha256Bytes(bytes) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    bytes
  );

  return digest.map(function(byte) {
    const value = (byte < 0 ? byte + 256 : byte).toString(16);
    return value.length === 1 ? "0" + value : value;
  }).join("");
}