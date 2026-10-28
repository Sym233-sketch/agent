/* Old resident service bookmarks lead back to the same product. Embedded tools stay tools. */
(()=>{'use strict';const q=new URLSearchParams(location.search);if(q.get('view')==='government'||q.get('embedded')==='1'||q.get('legacy')==='1')return;window.MINCETONG_SERVICE_REDIRECT=true;location.replace('/user.html'+(q.get('tab')==='assistant'?'#hall':'#progress'))})();
