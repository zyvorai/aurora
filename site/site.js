(function(){
  // copy buttons
  document.querySelectorAll('.term').forEach(function(t){
    var b=document.createElement('button');b.className='copy';b.type='button';b.textContent='Copy';
    b.addEventListener('click',function(){
      var txt=t.getAttribute('data-copy')||t.innerText.replace(/^Copy\n?/,'').replace(/^#.*$/gm,'').trim();
      (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(function(){b.textContent='Copied';setTimeout(function(){b.textContent='Copy'},1500)},function(){var r=document.createRange();r.selectNodeContents(t);var s=getSelection();s.removeAllRanges();s.addRange(r)});
    });t.appendChild(b);
  });
  // tabs with OS detection + hash
  var tabs=document.querySelector('.tabs');if(!tabs)return;
  var btns=[].slice.call(tabs.querySelectorAll('button'));
  function show(id){btns.forEach(function(b){var on=b.dataset.tab===id;b.setAttribute('aria-selected',on);document.getElementById('p-'+b.dataset.tab).hidden=!on});history.replaceState(null,'','#'+id)}
  btns.forEach(function(b){b.addEventListener('click',function(){show(b.dataset.tab)})});
  var h=location.hash.slice(1),ua=navigator.userAgent;
  var guess=/Windows/.test(ua)?'windows':/Mac/.test(ua)?'macos':/Linux|X11/.test(ua)?'linux':'macos';
  show(btns.some(function(b){return b.dataset.tab===h})?h:guess);
})();
(function(){ // docs search
  var q=document.getElementById('q');if(!q)return;var data=null,res=document.getElementById('res');
  q.addEventListener('input',function(){
    var v=q.value.trim().toLowerCase();res.innerHTML='';if(v.length<2)return;
    (data?Promise.resolve(data):fetch(q.dataset.index).then(function(r){return r.json()}).then(function(d){return data=d})).then(function(d){
      d.filter(function(x){return (x.title+' '+x.text).toLowerCase().indexOf(v)>=0}).slice(0,8).forEach(function(x){
        var a=document.createElement('a');a.href=q.dataset.base+'/docs/'+x.slug+'.html';a.textContent=x.title;res.appendChild(a)});
    });
  });
})();
