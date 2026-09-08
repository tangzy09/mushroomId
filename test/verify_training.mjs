/* test/verify_training.mjs — 认菌训练行为验收：详情页速测、范围闪卡、易混对决、
 * 每日 5 题、错题本、熟练度星级、训练结束不触发抽卡
 *   node test/verify_training.mjs [playwright-core 目录]
 * 需要 tools/serve.py 3141 在跑。走真实点击；题目集合、熟练度、错题本都拿 Storage 现场对拍。 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const pwDir = process.argv[2] || 'C:/Users/tangz/Documents/Projects/fishId/tests/node_modules';
const { chromium } = await import(pathToFileURL(path.join(pwDir, 'playwright-core', 'index.mjs')).href);
const BASE = 'http://127.0.0.1:3141/index.html';

let pass = 0, fail = 0;
const t = (name, ok, extra) => {
  if (ok) { pass++; console.log('  OK   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => { const o = document.getElementById('overlay'); if (o) o.classList.remove('on'); });
await page.waitForTimeout(600);

async function openDetail(id) {
  await page.evaluate(() => { if (!document.getElementById('page-collection').classList.contains('active')) document.querySelector('#nav button[data-page="collection"]').click(); });
  await page.waitForTimeout(150);
  // 前面别的测试段可能留了筛选条件，不清掉的话搜索会和筛选叠加，可能搜出 0 结果
  await page.evaluate(() => { const btn = document.getElementById('facet-clear'); if (btn) btn.click(); });
  await page.waitForTimeout(150);
  const name = await page.evaluate(id => MUSHROOM_DATA.find(m => m.id === id).name, id);
  await page.fill('#coll-search', name);
  await page.waitForTimeout(300);
  await page.evaluate(nm => {
    const cell = Array.from(document.querySelectorAll('#facet-right .fcard, #facet-grid .fcard, #facet-right .nrow'))
      .find(c => (c.querySelector('b') || c).textContent.trim().startsWith(nm));
    if (cell) cell.click();
  }, name);
  await page.waitForTimeout(700);
}
// 答完一整轮：每题都选第 0 个选项（对错都行，只是要走完流程，用在不关心结果的地方）
async function answerAllChoiceZero() {
  for (let i = 0; i < 6; i++) {
    const inQuiz = await page.evaluate(() => document.getElementById('page-quiz').classList.contains('active'));
    if (!inQuiz) break;
    const hasOpt = await page.$('#q-opts .opt');
    if (!hasOpt) break;
    await page.click('#q-opts .opt:first-child');
    await page.waitForTimeout(200);
    const nextBtn = await page.$('#q-explain button');
    if (!nextBtn) break;
    await nextBtn.click();
    await page.waitForTimeout(300);
  }
}
// 每题都选真正的正确答案——用在要验证「答对了会怎样」的地方，
// 不能靠 answerAllChoiceZero 混过去（那个对错全凭随机选项顺序）。
async function answerAllCorrect() {
  for (let i = 0; i < 6; i++) {
    const inQuiz = await page.evaluate(() => document.getElementById('page-quiz').classList.contains('active'));
    if (!inQuiz) break;
    const hasOpt = await page.$('#q-opts .opt');
    if (!hasOpt) break;
    await page.evaluate(() => document.querySelectorAll('#q-opts .opt')[_quizRound().pres.answerAt].click());
    await page.waitForTimeout(200);
    const nextBtn = await page.$('#q-explain button');
    if (!nextBtn) break;
    await nextBtn.click();
    await page.waitForTimeout(300);
  }
}
// 每题都故意选错——用在「验证一直待在错题本里」的地方。一个「单种速测」round
// 里全部 5 道题都是同一个种，中间随手用 answerAllChoiceZero 混过去，有一定概率
// 蒙对而把这个种从错题本里移出去，检查会跟着变得不稳定，所以这里全部故意选错。
async function answerAllWrong() {
  for (let i = 0; i < 6; i++) {
    const inQuiz = await page.evaluate(() => document.getElementById('page-quiz').classList.contains('active'));
    if (!inQuiz) break;
    const hasOpt = await page.$('#q-opts .opt');
    if (!hasOpt) break;
    await page.evaluate(() => {
      const wrongIdx = _quizRound().pres.options.findIndex((_, i) => i !== _quizRound().pres.answerAt);
      document.querySelectorAll('#q-opts .opt')[wrongIdx].click();
    });
    await page.waitForTimeout(200);
    const nextBtn = await page.$('#q-explain button');
    if (!nextBtn) break;
    await nextBtn.click();
    await page.waitForTimeout(300);
  }
}

/* T1 详情页「测一测」：题目全部是该种、答完不进抽卡结算页 */
await openDetail('shiitake');
const hasQuizBtn = await page.evaluate(() => Array.from(document.querySelectorAll('#page-detail button')).some(b => b.textContent.includes('测一测')));
t('详情页有「测一测」按钮', hasQuizBtn);
await page.click('#page-detail button:has-text("测一测")');
await page.waitForTimeout(600);
const inQuiz1 = await page.evaluate(() => document.getElementById('page-quiz').classList.contains('active'));
t('点击后进入答题页', inQuiz1);
const title1 = await page.evaluate(() => document.getElementById('quiz-title').textContent);
t('标题带物种名与「速测」', /香菇/.test(title1) && /速测/.test(title1), title1);
const allShiitake = await page.evaluate(() => _quizRound().questions.every(q => q.entityId === 'shiitake'));
t('题目全部是这一种', allShiitake);
const hasImageQ = await page.evaluate(() => _quizRound().questions.some(q => q.type === 'name_from_image'));
t('这一种的题里至少有一道看图题（熟练度只认这种）', hasImageQ);
const starsPre = await page.evaluate(() => Storage.masteryFor('shiitake'));
await answerAllCorrect();
await page.waitForTimeout(400);
const backAtDetail = await page.evaluate(() => document.getElementById('page-detail').classList.contains('active'));
const notReveal = await page.evaluate(() => !document.getElementById('page-reveal').classList.contains('active'));
t('答完回到详情页，没有进抽卡结算页', backAtDetail && notReveal, JSON.stringify({ backAtDetail, notReveal }));

/* T2 熟练度：全部答对之后，看图题那道真的把星涨上去了；按钮文案带星号 */
const starsAfter = await page.evaluate(() => Storage.masteryFor('shiitake'));
t('全部答对后熟练度真的涨了（不是装饰性的星星）', starsAfter > starsPre, starsPre + ' -> ' + starsAfter);
await openDetail('shiitake');
const btnLabelAfter = await page.evaluate(() => Array.from(document.querySelectorAll('#page-detail button')).find(b => b.textContent.includes('测一测')).textContent);
const expectedStars = '★'.repeat(starsAfter) + '☆'.repeat(3 - starsAfter);
t('按钮文案上的星号数与真实熟练度一致', btnLabelAfter.indexOf(expectedStars) >= 0, btnLabelAfter + ' want ' + expectedStars);

/* T3 「我的」页训练入口卡 + 训练中心四个模式 + 今日一鱼 */
await page.evaluate(() => document.querySelector('#nav button[data-page="profile"]').click());
await page.waitForTimeout(300);
const hasEntry = await page.evaluate(() => !!document.getElementById('btn-training'));
t('「我的」页有认菌训练入口卡', hasEntry);
await page.click('#btn-training');
await page.waitForTimeout(400);
const activeTraining = await page.evaluate(() => document.getElementById('page-training').classList.contains('active'));
t('点入口卡进了训练页', activeTraining);
const modeLabels = await page.evaluate(() => Array.from(document.querySelectorAll('#training-body .entry-card b')).map(b => b.textContent));
t('四个模式都在（范围闪卡/易混对决/每日5题/错题本）',
  ['范围闪卡', '易混对决', '每日 5 题', '错题本'].every(x => modeLabels.includes(x)), modeLabels.join());
const todayPickName = await page.evaluate(() => document.querySelector('#training-body .card b').textContent);
const realTodayPick = await page.evaluate(() => {
  const d = Storage.today(); let h = 0;
  for (let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) >>> 0;
  return MUSHROOM_DATA[h % MUSHROOM_DATA.length].name;
});
t('今日一鱼是按日期哈希算出来的那一种，不是随机的', todayPickName === realTodayPick, todayPickName + ' vs ' + realTodayPick);

/* T4 范围闪卡：先筛选图鉴，题目全部落在筛选结果里 */
await page.evaluate(() => document.querySelector('#nav button[data-page="collection"]').click());
await page.waitForTimeout(200);
await page.fill('#coll-search', '');
await page.click('#facet-tabs button[data-tab="silhouette"]');
await page.waitForTimeout(200);
await page.click('#facet-left .frow[data-val="ball"]');
await page.waitForTimeout(300);
const scopedIds = await page.evaluate(() => Browse._facet().results().map(m => m.id));
t('先把图鉴筛到「球与块」（正例地板）', scopedIds.length > 0 && scopedIds.length < 166, scopedIds.length);
await page.evaluate(() => document.querySelector('#nav button[data-page="profile"]').click());
await page.waitForTimeout(200);
await page.click('#btn-training');
await page.waitForTimeout(300);
await page.click('#training-body .entry-card:has-text("范围闪卡")');
await page.waitForTimeout(500);
const flashOk = await page.evaluate(ids => _quizRound().questions.every(q => ids.indexOf(q.entityId) >= 0), scopedIds);
t('范围闪卡的题目全部落在当时的筛选结果里', flashOk);
const flashTitle = await page.evaluate(() => document.getElementById('quiz-title').textContent);
t('标题是「范围闪卡」', flashTitle === '范围闪卡', flashTitle);
await answerAllChoiceZero();
await page.waitForTimeout(400);

/* T5 易混对决：entityId 与选项都对得上 lookalikes 关系 */
await page.evaluate(() => document.querySelector('#nav button[data-page="profile"]').click());
await page.waitForTimeout(200);
await page.click('#btn-training');
await page.waitForTimeout(300);
await page.click('#training-body .entry-card:has-text("易混对决")');
await page.waitForTimeout(500);
const duelCheck = await page.evaluate(() => {
  const q = _quizRound().questions[0];
  const a = MUSHROOM_DATA.find(m => m.id === q.entityId);
  const names = q.options;
  const answerName = names[q.answerIndex];
  return { type: q.type, isA: answerName === a.name, twoOpts: names.length === 2 };
});
t('易混对决：type 正确、恰好两个选项、正确项是那个种自己的名字',
  duelCheck.type === 'lookalike_duel' && duelCheck.twoOpts && duelCheck.isA, JSON.stringify(duelCheck));
await answerAllChoiceZero();
await page.waitForTimeout(400);

/* T6 每日 5 题：5 个不同物种，都是看图题 */
await page.evaluate(() => document.querySelector('#nav button[data-page="profile"]').click());
await page.waitForTimeout(200);
await page.click('#btn-training');
await page.waitForTimeout(300);
await page.click('#training-body .entry-card:has-text("每日 5 题")');
await page.waitForTimeout(500);
const dailyCheck = await page.evaluate(() => ({
  n: _quizRound().questions.length,
  allImage: _quizRound().questions.every(q => q.type === 'name_from_image'),
  distinct: new Set(_quizRound().questions.map(q => q.entityId)).size,
  title: document.getElementById('quiz-title').textContent
}));
t('每日 5 题：5 道看图题、物种不重复', dailyCheck.n === 5 && dailyCheck.allImage && dailyCheck.distinct === 5, JSON.stringify(dailyCheck));
await page.click('#page-quiz [data-back]');
await page.waitForTimeout(300);

/* T7 错题本：故意答错一题，验证它进了错题本，再从错题本模式里能测到，答对后移出 */
await openDetail('matsutake');
await page.click('#page-detail button:has-text("测一测")');
await page.waitForTimeout(500);
// 找到一个明确错误的选项（不是正确答案）点掉
await page.evaluate(() => {
  const wrongIdx = _quizRound().pres.options.findIndex((_, i) => i !== _quizRound().pres.answerAt);
  document.querySelectorAll('#q-opts .opt')[wrongIdx].click();
});
await page.waitForTimeout(300);
const inWrongBook = await page.evaluate(() => Storage.wrongList().includes('matsutake'));
t('答错之后松茸进了错题本', inWrongBook);
await page.click('#q-explain button');
await answerAllWrong();   // 这一整轮都是松茸的题，全部故意选错，免得蒙对被移出错题本
await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector('#nav button[data-page="profile"]').click());
await page.waitForTimeout(200);
const wrongSummary = await page.evaluate(() => document.getElementById('training-summary').textContent);
t('「我的」页训练入口卡文案反映错题本数量', /错题本还有/.test(wrongSummary), wrongSummary);
await page.click('#btn-training');
await page.waitForTimeout(300);
const wrongBookDesc = await page.evaluate(() => Array.from(document.querySelectorAll('#training-body .entry-card'))
  .find(c => c.querySelector('b').textContent === '错题本').querySelector('.muted').textContent);
t('错题本卡片显示题数', /还有 \d+ 道/.test(wrongBookDesc), wrongBookDesc);
await page.click('#training-body .entry-card:has-text("错题本")');
await page.waitForTimeout(500);
const wrongBookHasMatsutake = await page.evaluate(() => _quizRound().questions.some(q => q.entityId === 'matsutake'));
t('错题本模式里能测到松茸', wrongBookHasMatsutake);
// 这次答对（选正确答案），验证移出错题本
await page.evaluate(() => {
  const idx = _quizRound().questions.findIndex(q => q.entityId === 'matsutake');
  if (idx !== _quizRound().idx) return;
});
// 逐题作答，遇到 matsutake 就选正确答案，其它随便选第一个
for (let i = 0; i < 6; i++) {
  const inQuiz = await page.evaluate(() => document.getElementById('page-quiz').classList.contains('active'));
  if (!inQuiz) break;
  const hasOpt = await page.$('#q-opts .opt');
  if (!hasOpt) break;
  const isMats = await page.evaluate(() => _quizRound().questions[_quizRound().idx].entityId === 'matsutake');
  if (isMats) {
    await page.evaluate(() => document.querySelectorAll('#q-opts .opt')[_quizRound().pres.answerAt].click());
  } else {
    await page.click('#q-opts .opt:first-child');
  }
  await page.waitForTimeout(200);
  const nextBtn = await page.$('#q-explain button');
  if (!nextBtn) break;
  await nextBtn.click();
  await page.waitForTimeout(300);
}
const outOfWrongBook = await page.evaluate(() => !Storage.wrongList().includes('matsutake'));
t('答对之后松茸移出了错题本', outOfWrongBook);

t('本次运行零 JS 异常', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();
console.log('\n' + pass + ' 过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
