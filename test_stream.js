async function test() {
  try {
    const res = await fetch('https://www.google.com');
    if (typeof res.body.pipe === 'function') {
      console.log("Has .pipe()");
    } else {
      console.log("No .pipe() - This is a Web Stream");
    }
  } catch (e) {
    console.error("Fetch error or not available:", e.message);
  }
}
test();
