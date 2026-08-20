function checkWebsites() {
  let spreadsheet = SpreadsheetApp.getActive();
  let sheet = spreadsheet.getSheetByName('hash_checker');

  const rowNumber = 2;
  const url = "YOUR_WEBSITE_URL_THAT_SERVES_THE_HASH_CHECKER";
  const oldHash = "YOUR_TRUSTED_HASH_OF_HASH_CHECKER"; // if unchanged: 718e8d588506436a32415c682bcde611c97ba922e43082566a301a068b93cda7

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