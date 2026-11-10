/**
 * stablebail banner — bot ke connect (connection open) hone par sirf aik dafa
 * print hota hai. Socket config mein `banner: false` de kar band kar sakte hain.
 * Koi external dependency nahi, aur ye function kabhi throw nahi karta.
 */
const BANNER_LINES = [
    '╭───────────────────────────╮',
    '│      ✦ Q A D E E R ✦      │',
    '│ stablebail • Qadeer-Xtech │',
    '╰───────────────────────────╯'
];
export const printStablebailBanner = () => {
    try {
        console.log(BANNER_LINES.join('\n'));
    }
    catch {
        // banner kabhi bhi socket ko fail nahi kar sakta
    }
};
