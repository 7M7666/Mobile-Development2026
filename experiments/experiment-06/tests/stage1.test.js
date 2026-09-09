const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 32);

function matches(row, filter) {
  if (filter.orValues) return filter.orValues.some(f => matches(row, f));
  if (filter.andValues) return filter.andValues.every(f => matches(row, f));
  return Object.entries(filter).every(([key, value]) => {
    const actual = row[key];
    if (value && typeof value === 'object') {
      if ('inValues' in value) return value.inValues.includes(actual);
      if ('ninValues' in value) return !value.ninValues.includes(actual);
      if ('neqValue' in value) return actual !== value.neqValue;
      if ('regexp' in value) return (Array.isArray(actual) ? actual : [actual]).some(v => typeof v === 'string' && new RegExp(value.regexp, value.options).test(v));
    }
    return Array.isArray(actual) ? actual.includes(value) : actual === value;
  });
}
function backend() {
  let state = { users: {}, posts: {}, likes: {}, comments: {}, follows: {}, notifications: {} };
  let openid = 'alice';
  let clock = 0;
  let queue = Promise.resolve();
  let failUpdate = false;
  const database = (getState, throwOnNotFound = true) => ({
    collection(name) {
      let filter = {}, offset = 0, size = 100;
      const orders = [];
      const query = {
        field() { return query; },
        aggregate() {
          let rows = Object.values(getState()[name]).map(r => structuredClone(r));
          const agg = {
            match(f) { rows = rows.filter(r => matches(r, f)); return agg; },
            unwind(field) { const key = field.slice(1); rows = rows.flatMap(r => (r[key] || []).map(v => ({...r, [key]:v}))); return agg; },
            group(spec) { const groups = new Map(); for (const row of rows) { const id = row[spec._id.slice(1)]; groups.set(id, (groups.get(id) || 0) + 1); } rows = [...groups].map(([id,count]) => ({_id:id,count})); return agg; },
            sort(spec) { rows.sort((a,b) => { for (const [key,dir] of Object.entries(spec)) if (a[key] !== b[key]) return (a[key] > b[key] ? 1 : -1)*dir; return 0; }); return agg; },
            skip(n) { rows = rows.slice(n); return agg; }, limit(n) { rows = rows.slice(0,n); return agg; }, async end() { return {list:rows}; }
          }; return agg;
        },
        where(value) { filter = value; return query; },
        orderBy(key, direction) { orders.push([key, direction]); return query; },
        skip(value) { offset = value; return query; },
        limit(value) { size = value; return query; },
        async get() {
          let rows = Object.values(getState()[name]).filter(row => matches(row, filter));
          rows.sort((a, b) => {
            for (const [key, direction] of orders) {
              if (a[key] !== b[key]) return (a[key] > b[key] ? 1 : -1) * (direction === 'desc' ? -1 : 1);
            }
            return 0;
          });
          return { data: structuredClone(rows.slice(offset, offset + size)) };
        },
        async count() { const rows = await query.get(); return { total: rows.data.length }; },
        async update({ data }) {
          const rows = await query.get();
          for (const row of rows.data) await query.doc(row._id).update({ data });
          return { stats: { updated: rows.data.length } };
        },
        doc(id) {
          return {
            async get() {
              const data = getState()[name][id];
              if (!data && throwOnNotFound) throw new Error('document.get:fail document does not exist');
              return { data: structuredClone(data || null) };
            },
            async remove() { delete getState()[name][id]; },
            async set({ data }) { getState()[name][id] = structuredClone({ ...data, _id: id }); },
            async update({ data }) {
              if (failUpdate && name === 'users') throw new Error('simulated update failure');
              const doc = getState()[name][id];
              if (!doc) throw new Error('document missing');
              for (const [key, value] of Object.entries(data)) doc[key] = value && typeof value === 'object' && 'increment' in value ? doc[key] + value.increment : value;
            }
          };
        }
      };
      return query;
    }
  });
  const db = database(() => state);
  db.command = { inc: increment => ({ increment }), in: inValues => ({ inValues }), nin: ninValues => ({ ninValues }), neq: neqValue => ({ neqValue }), or: orValues => ({ orValues }), and: andValues => ({ andValues }), aggregate: {sum: n => n} };
  db.serverDate = () => new Date(1750000000000 + clock++);
  db.runTransaction = (callback, throwOnNotFound = true) => {
    const task = queue.then(async () => {
      const working = structuredClone(state);
      const result = await callback(database(() => working, throwOnNotFound));
      state = working;
      return result;
    });
    queue = task.catch(() => {});
    return task;
  };
  const sdk = { init() {}, database: (config = {}) => {
    const handle = database(() => state, config.throwOnNotFound !== false);
    handle.command = db.command; handle.RegExp = value => value;
    handle.serverDate = db.serverDate;
    handle.runTransaction = callback => db.runTransaction(callback, config.throwOnNotFound !== false);
    return handle;
  }, getWXContext: () => ({ OPENID: openid }) };
  const functions = {};
  for (const name of ['login', 'createPost', 'getPosts', 'getPostDetail', 'getUserProfile', 'toggleLike', 'toggleFollow', 'addComment', 'getComments', 'getNotifications', 'markNotificationsRead', 'searchContent', 'deletePost']) {
    const context = { exports: {}, require: id => id === 'wx-server-sdk' ? sdk : require(id), console: { error() {} } };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'cloudfunctions', name, 'index.js'), 'utf8'), context);
    functions[name] = context.exports.main;
  }
  return { ...functions, state: () => state, as: id => { openid = id; }, failUpdate: () => { failUpdate = true; } };
}
function draft(count = 3, requestId = 'request-0001', owner = 'alice') {
  return { requestId, images: Array.from({ length: count }, (_, i) => `cloud://env.bucket/moments/${hash(owner)}/${requestId}/${i}.jpg`), caption: '今天海边的风很大', tags: ['海大', '海边'], location: { name: '中国海洋大学', latitude: null, longitude: null } };
}
test('concurrent login creates one identity from OPENID', async () => {
  const b = backend();
  const results = await Promise.all([b.login({ _openid: 'mallory' }), b.login()]);
  assert.equal(Object.keys(b.state().users).length, 1);
  assert.ok(results.every(res => res.openid === 'alice' && res.userInfo.postCount === 0));
});
for (const count of [1, 3, 9]) test(`${count} images produce one post and increment postCount once`, async () => {
  const b = backend(); await b.login();
  const res = await b.createPost(draft(count));
  assert.equal(res.success, true);
  assert.equal(Object.keys(b.state().posts).length, 1);
  assert.equal(b.state().posts[res.postId].images.length, count);
  assert.equal(b.state().users[hash('alice')].postCount, 1);
  assert.equal(b.state().posts[res.postId].author.nickName, '海大同学');
});
test('retry and concurrent duplicate submissions are idempotent', async () => {
  const b = backend(); await b.login();
  const results = await Promise.all([b.createPost(draft()), b.createPost(draft())]);
  const retry = await b.createPost(draft());
  assert.ok(results.every(res => res.success && res.postId === retry.postId));
  assert.equal(b.state().users[hash('alice')].postCount, 1);
  const changed = await b.createPost({ ...draft(), caption: 'changed' });
  assert.equal(changed.success, false);
  assert.equal(b.state().posts[retry.postId].caption, draft().caption);
});
test('invalid photos, forged identity and oversized fields cannot write data', async () => {
  const b = backend(); await b.login();
  const invalid = [draft(0), draft(10), draft(1, 'request-0001', 'bob'), { ...draft(), images: 'cloud://a' }, { ...draft(), images: ['https://example.com/a.jpg'] }, { ...draft(), caption: 'a'.repeat(1001) }, { ...draft(), tags: Array(6).fill('tag') }, { ...draft(), location: null }];
  for (const input of invalid) assert.equal((await b.createPost(input)).success, false);
  assert.equal(Object.keys(b.state().posts).length, 0);
});
test('counter failure rolls back the post', async () => {
  const b = backend(); await b.login(); b.failUpdate();
  assert.equal((await b.createPost(draft())).success, false);
  assert.equal(Object.keys(b.state().posts).length, 0);
  assert.equal(b.state().users[hash('alice')].postCount, 0);
});
test('pagination returns newest first and ends correctly', async () => {
  const b = backend(); await b.login();
  for (let i = 0; i < 5; i++) await b.createPost(draft(1, `request-000${i}`));
  const a = await b.getPosts({ page: 1, pageSize: 3 });
  const z = await b.getPosts({ page: 2, pageSize: 3 });
  assert.equal(a.posts.length, 3); assert.equal(a.hasMore, true);
  assert.equal(z.posts.length, 2); assert.equal(z.hasMore, false);
  assert.ok(a.posts[0].createTime > z.posts[0].createTime);
  assert.equal(new Set([...a.posts, ...z.posts].map(p => p._id)).size, 5);
  assert.equal((await b.getPosts({ page: 0 })).success, false);
  assert.equal((await b.getPosts({ pageSize: 100 })).success, false);
});
test('profile uses target OPENID and defaults to the current user', async () => {
  const b = backend(); await b.login(); await b.createPost(draft());
  b.as('bob'); await b.login(); await b.createPost(draft(1, 'request-0002', 'bob'));
  const mine = await b.getUserProfile({ targetOpenid: '' });
  const alice = await b.getUserProfile({ targetOpenid: 'alice' });
  assert.equal(mine.userInfo._openid, 'bob'); assert.equal(mine.posts.length, 1);
  assert.equal(alice.userInfo._openid, 'alice'); assert.equal(alice.isSelf, false);
  assert.ok(alice.posts.every(p => p._openid === 'alice'));
});
test('detail increments views and rejects nonexistent posts', async () => {
  const b = backend(); await b.login(); const created = await b.createPost(draft());
  const first = await b.getPostDetail({ postId: created.postId });
  const refresh = await b.getPostDetail({ postId: created.postId, countView: false });
  assert.equal(first.post.viewCount, 1); assert.equal(refresh.post.viewCount, 1);
  assert.equal((await b.getPostDetail({ postId: 'a'.repeat(32) })).success, false);
});
test('all cloud functions require a server-provided identity', async () => {
  const b = backend(); b.as('');
  for (const name of ['login', 'createPost', 'getPosts', 'getPostDetail', 'getUserProfile', 'toggleLike', 'toggleFollow', 'addComment', 'getComments', 'getNotifications', 'markNotificationsRead', 'searchContent', 'deletePost']) assert.equal((await b[name]({ _openid: 'alice' })).success, false);
});

function loadPage(name, api, wx = {}) {
  let definition;
  const context = { Page: value => { definition = value; }, require: () => api, getApp: () => wx.app, wx, console: { error() {} } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'miniprogram/pages', name, `${name}.js`), 'utf8'), context);
  definition.data = structuredClone(definition.data);
  definition.setData = function (patch) {
    for (const [key, value] of Object.entries(patch)) {
      const match = key.match(/^images\[(\d+)\]\.fileID$/);
      if (match) this.data.images[Number(match[1])].fileID = value;
      else this.data[key] = value;
    }
  };
  return definition;
}
test('publisher keeps uploaded files and request ID after uncertain response', async () => {
  let uploadCount = 0, callCount = 0;
  const requests = [];
  const wx = { app: { ensureLogin: async () => ({ _id: hash('alice') }), globalData: {} }, showToast() {}, switchTab() {} };
  const page = loadPage('publish', {
    upload: async (_file, cloudPath) => { uploadCount++; return `cloud://env.bucket/${cloudPath}`; },
    message: error => error.message,
    call: async (_name, request) => { requests.push(request); if (++callCount === 1) throw new Error('response lost'); return { success: true }; }
  }, wx);
  page.data.images = [{ path: '/a.jpg', fileID: '' }, { path: '/b.jpg', fileID: '' }, { path: '/c.jpg', fileID: '' }];
  await page.publish();
  assert.equal(page.data.submitted, true); assert.equal(page.data.images.length, 3);
  page.deleteImage({ currentTarget: { dataset: { index: 0 } } });
  assert.equal(page.data.images.length, 3);
  await page.publish();
  assert.equal(uploadCount, 3); assert.equal(requests[0].requestId, requests[1].requestId);
  assert.equal(requests[0].images.length, 3); assert.equal(page.data.images.length, 0);
  assert.equal(wx.app.globalData.needRefreshHome, true);
});
test('unconfigured cloud preserves draft and never reports success', async () => {
  let invoked = false;
  const page = loadPage('publish', { message: error => error.message, call: async () => { invoked = true; } }, { app: { ensureLogin: async () => { throw new Error('云环境尚未配置'); } }, showToast() {}, switchTab() { throw new Error('must not navigate'); } });
  page.data.images = [{ path: '/a.jpg', fileID: '' }];
  await page.publish();
  assert.equal(invoked, false); assert.equal(page.data.images.length, 1);
  assert.equal(page.data.publishing, false); assert.match(page.data.error, /尚未配置/);
});
test('feed failure keeps page number so retry loads the same page', async () => {
  let fail = true;
  const requested = [];
  const page = loadPage('home', { formatPost: p => p, message: e => e.message, call: async (_name, request) => { requested.push(request.page); if (fail) throw new Error('offline'); return { posts: [{ _id: 'p', images: ['cloud://test/photo.jpg'] }], hasMore: false }; } });
  await page.loadPosts(true); assert.equal(page.data.page, 0);
  fail = false; await page.retry();
  assert.deepEqual(requested, [1, 1]); assert.equal(page.data.posts.length, 1); assert.equal(page.data.hasMore, false);
});

test('missing cloud function is translated without exposing the SDK trace', async () => {
  const api = require('../miniprogram/services/api');
  global.wx = { cloud: { callFunction: async () => { throw { errCode: -501000, errMsg: 'FunctionName parameter could not be found. FUNCTION_NOT_FOUND trace: secret-trace' }; } } };
  try {
    await assert.rejects(api.request('login'), error => {
      const text = api.message(error);
      assert.match(text, /登录服务尚未部署/);
      assert.doesNotMatch(text, /trace|FUNCTION_NOT_FOUND|secret/);
      return true;
    });
  } finally { delete global.wx; }
});


async function socialFixture() {
  const b = backend();
  await b.login(); const { postId } = await b.createPost(draft());
  b.as('bob'); await b.login();
  return { b, postId };
}
test('likes are idempotent and unlike restores counters and removes notification', async () => {
  const { b, postId } = await socialFixture();
  const results = await Promise.all([b.toggleLike({ postId, liked:true }), b.toggleLike({ postId, liked:true })]);
  assert.ok(results.every(r => r.success));
  assert.equal(b.state().posts[postId].likeCount,1);
  assert.equal(b.state().users[hash('alice')].likeReceivedCount,1);
  assert.equal(Object.keys(b.state().notifications).length,1);
  assert.equal((await b.getPosts()).posts[0].isLiked,true);
  await b.toggleLike({ postId,liked:false }); await b.toggleLike({ postId,liked:false });
  assert.equal(b.state().posts[postId].likeCount,0);
  assert.equal(b.state().users[hash('alice')].likeReceivedCount,0);
  assert.equal(Object.keys(b.state().notifications).length,0);
});
test('transaction failure rolls back like and notification together', async () => {
  const { b, postId } = await socialFixture(); b.failUpdate();
  assert.equal((await b.toggleLike({ postId,liked:true })).success,false);
  assert.equal(Object.keys(b.state().likes).length,0);
  assert.equal(Object.keys(b.state().notifications).length,0);
  assert.equal(b.state().posts[postId].likeCount,0);
});
test('following feed is isolated and follow retries preserve both counters', async () => {
  const { b, postId } = await socialFixture();
  await b.createPost(draft(1,'bob-post-1','bob'));
  assert.equal((await b.getPosts({ mode:'following' })).posts.length,0);
  await Promise.all([b.toggleFollow({ targetOpenid:'alice',following:true }),b.toggleFollow({ targetOpenid:'alice',following:true })]);
  const feed=await b.getPosts({ mode:'following' });
  assert.equal(feed.posts.length,1); assert.equal(feed.posts[0]._id,postId);
  assert.equal(b.state().users[hash('alice')].followerCount,1);
  assert.equal(b.state().users[hash('bob')].followingCount,1);
  assert.equal((await b.toggleFollow({ targetOpenid:'bob',following:true })).success,false);
  await b.toggleFollow({ targetOpenid:'alice',following:false });
  assert.equal((await b.getPosts({ mode:'following' })).posts.length,0);
  assert.equal(b.state().users[hash('alice')].followerCount,0);
});
test('comments retry once, update received counts, and use server author', async () => {
  const { b, postId } = await socialFixture();
  const input={ postId,content:'这是崂山校区吗？',requestId:'comment-request-1',authorName:'forged' };
  await Promise.all([b.addComment(input),b.addComment(input)]);
  assert.equal(b.state().posts[postId].commentCount,1);
  assert.equal(b.state().users[hash('alice')].commentReceivedCount,1);
  const comments=await b.getComments({ postId });
  assert.equal(comments.comments.length,1); assert.equal(comments.comments[0].authorName,'海大同学');
  assert.equal((await b.addComment({ ...input,content:'changed' })).success,false);
  assert.equal((await b.addComment({ ...input,content:' ' })).success,false);
});
test('notifications and mark-read are scoped to the current receiver', async () => {
  const { b, postId } = await socialFixture();
  await b.toggleLike({ postId,liked:true });
  const id=Object.keys(b.state().notifications)[0];
  assert.equal((await b.getNotifications({ receiverOpenid:'alice' })).notifications.length,0);
  await b.markNotificationsRead({ ids:[id],receiverOpenid:'alice' });
  assert.equal(b.state().notifications[id].isRead,false);
  b.as('alice'); assert.equal((await b.getNotifications()).unreadCount,1);
  await b.markNotificationsRead({ ids:[id] });
  assert.equal((await b.getNotifications()).unreadCount,0);
  await b.toggleLike({ postId,liked:true });
  assert.equal(Object.keys(b.state().notifications).length,1,'self-like must not notify');
});
test('profile edits cannot modify another user and hydrate existing posts', async () => {
  const { b, postId } = await socialFixture();
  const edit={ action:'update',nickName:'小海',bio:'拍校园',avatarUrl:'',coverUrl:'' };
  assert.equal((await b.getUserProfile({ ...edit,targetOpenid:'alice' })).success,false);
  b.as('alice');
  assert.equal((await b.getUserProfile({ ...edit,coverUrl:'cloud://env.bucket/profiles/other/cover.jpg' })).success,false);
  assert.equal((await b.getUserProfile(edit)).success,true);
  assert.equal((await b.getPostDetail({ postId,countView:false })).post.author.nickName,'小海');
  assert.equal((await b.getPosts()).posts[0].author.nickName,'小海');
});
test('my likes is paginated by likes and returns liked posts', async () => {
  const { b, postId } = await socialFixture();
  await b.toggleLike({ postId,liked:true });
  const res=await b.getUserProfile({ tab:'likes' });
  assert.equal(res.posts.length,1); assert.equal(res.posts[0]._id,postId); assert.equal(res.posts[0].isLiked,true);
});

test('following mode selection resets pagination and requests the chosen feed', async () => {
  const requests=[];
  const page=loadPage('home',{call:async (name,data)=>{requests.push(data);return {posts:[],hasMore:false};},formatPost:p=>p,message:e=>e.message});
  page.data.page=4;
  page.changeMode({currentTarget:{dataset:{mode:'following'}}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests[0].mode,'following');assert.equal(requests[0].page,1);assert.equal(page.data.posts.length,0);
});
test('comment response loss preserves text and reuses its request ID', async () => {
  const requests=[];let count=0;
  const page=loadPage('detail',{message:e=>e.message,call:async (name,data)=>{
    if(name==='addComment'){requests.push(data);if(count++===0)throw new Error('response lost');return {success:true};}
  }},{app:{globalData:{}}});
  page.postId='a'.repeat(32);page.data.commentText='真好看';
  page.loadDetail=async()=>{};page.loadComments=async()=>{};
  await page.sendComment();assert.equal(page.data.commentPending,true);assert.equal(page.data.commentText,'真好看');
  page.inputComment({detail:{value:'cannot change'}});assert.equal(page.data.commentText,'真好看');
  await page.sendComment();assert.equal(requests[0].requestId,requests[1].requestId);assert.equal(page.data.commentText,'');assert.equal(page.data.commentPending,false);
});
test('custom tab bar tracks route and only selects after successful navigation',()=>{
  let component;const navigations=[];
  const context={Component:c=>{component=c;},getCurrentPages:()=>[{route:'pages/mine/mine'}],wx:{switchTab:opts=>navigations.push(opts)}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'miniprogram/custom-tab-bar/index.js'),'utf8'),context);
  const instance={data:structuredClone(component.data),setData(patch){Object.assign(this.data,patch);},...component.methods};
  instance.sync();assert.equal(instance.data.selected,3);
  instance.select({currentTarget:{dataset:{index:0}}});assert.equal(instance.data.selected,3);
  assert.equal(navigations[0].url,'/pages/home/home');navigations[0].success();assert.equal(instance.data.selected,0);
});


test('delete is owner-only, idempotent, cleans relations and hides all post surfaces', async () => {
  const {b,postId}=await socialFixture();
  await b.toggleLike({postId,liked:true});
  await b.addComment({postId,content:'hello',requestId:'comment-delete-1'});
  assert.equal((await b.deletePost({postId})).success,false);
  b.as('alice');
  assert.equal((await b.getPostDetail({postId})).post.isOwner,true);
  assert.equal((await b.deletePost({postId})).success,true);
  assert.equal((await b.deletePost({postId})).success,true);
  const user=b.state().users[hash('alice')];
  assert.equal(user.postCount,0);assert.equal(user.likeReceivedCount,0);assert.equal(user.commentReceivedCount,0);
  for(const collection of ['likes','comments','notifications']) assert.equal(Object.keys(b.state()[collection]).length,0);
  assert.equal((await b.getPosts()).posts.length,0);
  assert.equal((await b.getUserProfile()).posts.length,0);
  assert.equal((await b.searchContent({keyword:'海',type:'post'})).posts.length,0);
  assert.equal((await b.searchContent({keyword:'海',type:'tag'})).tags.length,0);
  assert.equal((await b.getPostDetail({postId})).success,false);
  assert.equal((await b.getComments({postId})).success,false);
  assert.equal((await b.toggleLike({postId,liked:true})).success,false);
  assert.equal((await b.addComment({postId,content:'hello',requestId:'comment-delete-1'})).success,false);
  assert.equal((await b.createPost(draft())).success,false);
});
test('delete rolls back counters and tombstone on failure', async()=>{
  const b=backend();await b.login();const {postId}=await b.createPost(draft());b.failUpdate();
  assert.equal((await b.deletePost({postId})).success,false);
  assert.equal(b.state().posts[postId].deleted,undefined);
});
test('search escapes regex, searches captions and tags, and paginates',async()=>{
  const b=backend();await b.login();
  await b.createPost({...draft(9,'request-search-1'),caption:'literal .* [',tags:['海边']});
  await b.createPost({...draft(1,'request-search-2'),caption:'second',tags:['海边摄影']});
  assert.equal((await b.searchContent({keyword:'.*'})).posts.length,1);
  assert.equal((await b.searchContent({keyword:'['})).posts.length,1);
  const first=await b.searchContent({keyword:'海边',pageSize:1});
  assert.equal(first.posts.length,1);assert.equal(first.hasMore,true);
  assert.equal((await b.searchContent({keyword:'海边',pageSize:1,page:2})).hasMore,false);
  const tags=await b.searchContent({keyword:'海边',type:'tag'});
  assert.equal(tags.tags.length,2);assert.ok(tags.tags.every(t=>t.count===1));
  assert.equal((await b.getPosts({mode:'tag',tag:'海边'})).posts.length,1);
  assert.equal((await b.searchContent({keyword:'海大',type:'user'})).users[0].isSelf,true);
});
test('recommendations exclude self and all followed users beyond one hundred',async()=>{
  const b=backend();await b.login();
  for(let i=0;i<102;i++) { const id='u'+i;b.state().users[hash(id)]={_id:hash(id),_openid:id,nickName:id,followerCount:i};b.state().follows[hash(id)]={_id:hash(id),_openid:'alice',targetOpenid:id}; }
  b.state().users[hash('new')]={_id:hash('new'),_openid:'new',followerCount:0};
  const result=await b.getUserProfile({getRecommended:true});
  assert.equal(result.users.length,1);assert.equal(result.users[0]._openid,'new');
});
test('hot feed ranks by likes before recency',async()=>{
 const b=backend();await b.login();const a=await b.createPost(draft(1,'request-hot-1'));await b.createPost(draft(1,'request-hot-2'));
 await b.toggleLike({postId:a.postId,liked:true});
 assert.equal((await b.getPosts({sortBy:'hot'})).posts[0]._id,a.postId);
});
function editor(api,wx) {
 const context={module:{exports:{}},require:()=>api,wx,getApp:()=>wx.app};
 vm.runInNewContext(fs.readFileSync(path.join(root,'miniprogram/services/profile-page.js'),'utf8'),context);
 const page=context.module.exports(true);page.setData=function(patch){Object.assign(this.data,patch);};
 page.data.draft={nickName:'old',bio:'',avatarUrl:'',coverUrl:''};page.data.editing=true;return page;
}
test('profile rejects old read-only success response and retains draft',async()=>{
 let toasted=false;const wx={app:{globalData:{}},showToast(){toasted=true;}};
 const page=editor({call:async()=>({success:true,userInfo:{nickName:'old'}}),message:e=>e.message},wx);
 await page.saveProfile({detail:{value:{nickName:'new',bio:'bio'}}});
 assert.equal(toasted,false);assert.equal(page.data.editing,true);assert.equal(page.data.draft.nickName,'new');assert.match(page.data.editError,/getUserProfile/);
});
test('profile submits latest form values and updates local profile only after confirmation',async()=>{
 let sent;const wx={app:{globalData:{}},showToast(){}};
 const page=editor({call:async(_name,data)=>{sent=data;return {updated:true,userInfo:{...data,nickName:data.nickName.trim(),bio:data.bio.trim()}};},message:e=>e.message},wx);
 await page.saveProfile({detail:{value:{nickName:' new ',bio:' bio '}}});
 assert.equal(sent.nickName,' new ');assert.equal(page.data.user.nickName,'new');assert.equal(page.data.editing,false);assert.equal(wx.app.globalData.needRefreshHome,true);
});
test('unchanged legacy avatar is accepted and profile survives reload',async()=>{
 const b=backend();await b.login();b.state().users[hash('alice')].avatarUrl='https://example.com/avatar.jpg';
 const res=await b.getUserProfile({action:'update',nickName:'new',bio:'bio'});
 assert.equal(res.updated,true);assert.equal((await b.getUserProfile()).userInfo.nickName,'new');
});
test('stale search responses cannot replace a newer query',async()=>{
 const pending=[];const page=loadPage('search',{call:(_n,args)=>new Promise(resolve=>pending.push({args,resolve})),message:e=>e.message});
 page.data.keyword='old';const old=page.onSearchConfirm();page.data.keyword='new';const current=page.onSearchConfirm();
 pending[1].resolve({posts:[{_id:'new'}],hasMore:false});await current;
 pending[0].resolve({posts:[{_id:'old'}],hasMore:true});await old;
 assert.equal(page.data.posts[0]._id,'new');assert.equal(page.data.loading,false);
});


test('my posts delete requires confirmation and refreshes after confirmed success', async()=>{
 let confirmed=false,deleted=0,reloaded=0;
 const wx={app:{globalData:{}},showModal:async()=>({confirm:confirmed}),showToast(){}};
 const page=editor({call:async(name,args)=>{assert.equal(name,'deletePost');assert.equal(args.postId,'p');deleted++;},message:e=>e.message},wx);
 page.data.isSelf=true;page.data.tab='posts';page.data.posts=[{_id:'p'}];page.loadProfile=async()=>{reloaded++;};
 const event={currentTarget:{dataset:{id:'p'}}};
 await page.deleteOwnPost(event);assert.equal(deleted,0);assert.equal(page.data.posts.length,1);assert.equal(page.data.deletingId,'');
 confirmed=true;await page.deleteOwnPost(event);assert.equal(deleted,1);assert.equal(reloaded,1);assert.equal(page.data.posts.length,0);assert.equal(wx.app.globalData.needRefreshHome,true);
});
test('my posts failed deletion retains the entry for retry; likes cannot delete', async()=>{
 let called=0;
 const page=editor({call:async()=>{called++;throw new Error('offline');},message:e=>e.message},{app:{globalData:{}},showModal:async()=>({confirm:true})});
 page.data.isSelf=true;page.data.tab='likes';page.data.posts=[{_id:'p'}];const event={currentTarget:{dataset:{id:'p'}}};
 await page.deleteOwnPost(event);assert.equal(called,0);
 page.data.tab='posts';await page.deleteOwnPost(event);assert.equal(called,1);assert.equal(page.data.posts.length,1);assert.equal(page.data.error,'offline');assert.equal(page.data.deletingId,'');
});


test('feed rejects incomplete records instead of displaying blank social cards',async()=>{
 const page=loadPage('home',{call:async()=>({posts:[{tags:['campus']}],hasMore:false}),formatPost:p=>p,message:e=>e.message});
 await page.loadPosts(true);
 assert.equal(page.data.posts.length,0);assert.equal(page.data.page,1);assert.equal(page.data.error,'');assert.equal(page.data.skippedCount,1);
});


test('one malformed post does not hide healthy posts or block subsequent pages',async()=>{
 const requests=[];const page=loadPage('home',{call:async(_n,args)=>{requests.push(args.page);return args.page===1?{posts:[{tags:[]},{_id:'ok',images:['cloud://a']}],hasMore:true}:{posts:[{_id:'next',images:['cloud://b']}],hasMore:false};},formatPost:p=>p,message:e=>e.message});
 await page.loadPosts(true);assert.equal(page.data.posts[0]._id,'ok');assert.equal(page.data.skippedCount,1);
 await page.loadPosts(false);assert.equal(page.data.posts[1]._id,'next');assert.equal(page.data.hasMore,false);assert.deepEqual(requests,[1,2]);
});
