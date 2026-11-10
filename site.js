
(function(){
  const slides=[...document.querySelectorAll(".hero-slide")];
  if(slides.length<2||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  let current=0;
  window.setInterval(()=>{slides[current].classList.remove("is-active");current=(current+1)%slides.length;slides[current].classList.add("is-active");},5000);
})();
document.getElementById("intentionForm")?.addEventListener("submit",function(event){
  event.preventDefault();
  const notice=document.getElementById("formNotice");
  if(notice)notice.style.display="block";
});
const SUPABASE_URL="https://yheyyjevcmlcujribfhp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_2fjZEsGcJ19caWo3vpR43A_l-x1w5-3";
const supabaseHeaders={apikey:SUPABASE_PUBLISHABLE_KEY};
function storagePublicUrl(path){
  if(!path)return "";
  const value=String(path).trim();
  if(/^https?:\/\//i.test(value))return value;
  return `${SUPABASE_URL}/storage/v1/object/public/parish-media/${value.replace(/^\/+/,"")}`;
}
function showMessage(container,message){
  container.replaceChildren();
  const p=document.createElement("p");p.className="empty-message";p.textContent=message;container.append(p);
}

/* Pages des sacrements : lecture des fiches publiées dans parish_sacrament_pages. */
function safeSacramentContent(container, value){
  const raw=String(value||"").trim();
  if(!raw)return;
  // Le contenu peut être du texte simple ou du HTML provenant de l'éditeur.
  if(!/<[a-z][\s\S]*>/i.test(raw)){
    const paragraph=document.createElement("p");paragraph.textContent=raw;container.append(paragraph);return;
  }
  const parsed=new DOMParser().parseFromString(raw,"text/html");
  const allowed=new Set(["P","BR","STRONG","B","EM","I","U","UL","OL","LI","H3","H4","A"]);
  function copySafeNode(node,parent){
    if(node.nodeType===Node.TEXT_NODE){parent.append(document.createTextNode(node.nodeValue||""));return;}
    if(node.nodeType!==Node.ELEMENT_NODE)return;
    if(!allowed.has(node.tagName)){
      [...node.childNodes].forEach(child=>copySafeNode(child,parent));return;
    }
    const clean=document.createElement(node.tagName.toLowerCase());
    if(node.tagName==="A"){
      const href=node.getAttribute("href")||"";
      try{const url=new URL(href,window.location.origin);if(["https:","http:"].includes(url.protocol)){clean.href=url.href;clean.target="_blank";clean.rel="noopener noreferrer";}}
      catch(_error){}
    }
    [...node.childNodes].forEach(child=>copySafeNode(child,clean));parent.append(clean);
  }
  [...parsed.body.childNodes].forEach(node=>copySafeNode(node,container));
}

async function loadSacramentPages(){
  const container=document.getElementById("sacramentPages");
  if(!container)return;
  const defaultTitles={bapteme:"Baptême",mariage:"Mariage","premiere-communion-confirmation":"Première communion et confirmation"};
  try{
    const endpoint=`${SUPABASE_URL}/rest/v1/parish_sacrament_pages?select=slug,title,summary,content,media,is_published&is_published=eq.true&order=slug.asc`;
    const response=await fetch(endpoint,{headers:supabaseHeaders});
    if(!response.ok)throw new Error(`Lecture de parish_sacrament_pages (${response.status}) : ${await response.text()}`);
    const pages=await response.json();
    container.replaceChildren();
    if(!pages.length){showMessage(container,"Les informations sur les sacrements seront bientôt disponibles.");return;}
    pages.forEach(page=>{
      const card=document.createElement("article");card.className="card sacrament-card";
      const title=document.createElement("h3");title.textContent=String(page.title||defaultTitles[page.slug]||"Sacrement").trim();
      card.append(title);
      if(page.summary&&String(page.summary).trim()){
        const summary=document.createElement("p");summary.className="sacrament-summary";summary.textContent=page.summary;card.append(summary);
      }
      if(page.content&&String(page.content).trim()){
        const content=document.createElement("div");content.className="sacrament-content";safeSacramentContent(content,page.content);card.append(content);
      }
      const mediaItems=Array.isArray(page.media)?page.media:[];
      const usableMedia=mediaItems.filter(item=>item&&item.path);
      if(usableMedia.length){
        const mediaList=document.createElement("div");mediaList.className="sacrament-media-list";
        usableMedia.forEach(item=>{
          const mediaCard=document.createElement("div");mediaCard.className="sacrament-media-item";
          const mediaUrl=storagePublicUrl(item.path);
          if(item.type==="video"){
            const player=document.createElement("video");player.controls=true;player.playsInline=true;player.preload="metadata";player.src=mediaUrl;
            player.setAttribute("aria-label",item.name||`Vidéo ${title.textContent}`);
            player.addEventListener("error",()=>console.error("Vidéo de sacrement inaccessible :",item.path));
            mediaCard.append(player);
          }else if(item.type==="image"||!item.type){
            const image=document.createElement("img");image.src=mediaUrl;image.alt=item.name||title.textContent;image.loading="lazy";image.dataset.galleryZoom="true";
            image.addEventListener("error",()=>{console.error("Image de sacrement inaccessible :",item.path);mediaCard.remove();});
            mediaCard.append(image);
          }else{
            return;
          }
          if(item.name){const caption=document.createElement("div");caption.className="sacrament-media-caption";caption.textContent=item.name;mediaCard.append(caption);}
          mediaList.append(mediaCard);
        });
        if(mediaList.children.length)card.append(mediaList);
      }
      if(!page.summary&&!page.content&&!usableMedia.length){
        const fallback=document.createElement("p");fallback.className="sacrament-summary";fallback.textContent="Les informations détaillées seront bientôt communiquées par le secrétariat paroissial.";card.append(fallback);
      }
      container.append(card);
    });
  }catch(error){
    console.error("Chargement des pages de sacrements impossible :",error);
    showMessage(container,"Les informations sur les sacrements sont momentanément indisponibles. Vérifiez les autorisations de lecture (RLS) de parish_sacrament_pages dans Supabase.");
  }
}

/* Affichage public des programmes de catéchèse publiés dans Supabase */
async function loadCatechesisPrograms(){
 const container=document.getElementById("catechesisPublicList");if(!container)return;
 try{
  const endpoint=`${SUPABASE_URL}/rest/v1/catechesis_programs?select=id,title,description,levels,age_range,schedule,start_date,registration_deadline,location,fee,contact_name,contact_phone,contact_email,requirements,is_published&is_published=eq.true&order=created_at.desc`;
  const response=await fetch(endpoint,{headers:supabaseHeaders});
  if(!response.ok)throw new Error(`Lecture des programmes de catéchèse (${response.status}) : ${await response.text()}`);
  const programs=await response.json();container.replaceChildren();
  if(!programs.length){showMessage(container,"Les informations sur la catéchèse seront bientôt disponibles auprès du secrétariat paroissial.");return;}
  const formatDateFr=value=>{if(!value)return "";const d=new Date(value+"T00:00:00");return Number.isNaN(d.getTime())?value:d.toLocaleDateString("fr-FR");};
  programs.forEach(program=>{
   const card=document.createElement("article");card.className="card sacrament-card catechesis-card";
   const title=document.createElement("h3");title.textContent=program.title||"Catéchèse";card.append(title);
   if(program.description){const p=document.createElement("p");p.className="catechesis-description";p.textContent=program.description;card.append(p);}
   const meta=document.createElement("div");meta.className="catechesis-meta";
   const addMeta=(label,value)=>{if(value){const p=document.createElement("p");const strong=document.createElement("strong");strong.textContent=label+" : ";p.append(strong,document.createTextNode(value));meta.append(p);}};
   addMeta("Niveaux",program.levels);addMeta("Public concerné",program.age_range);addMeta("Jours et horaires",program.schedule);
   addMeta("Début",formatDateFr(program.start_date));addMeta("Date limite d'inscription",formatDateFr(program.registration_deadline));
   addMeta("Lieu",program.location);addMeta("Participation",program.fee);if(meta.childNodes.length)card.append(meta);
   if(program.requirements){const p=document.createElement("p");p.className="catechesis-description";const strong=document.createElement("strong");strong.textContent="Conditions et documents : ";p.append(strong,document.createTextNode(program.requirements));card.append(p);}
   if(program.contact_name||program.contact_phone||program.contact_email){
    const contact=document.createElement("div");contact.className="catechesis-contact";
    if(program.contact_name){const p=document.createElement("p");p.textContent="Contact : "+program.contact_name;contact.append(p);}
    if(program.contact_phone){const p=document.createElement("p");const a=document.createElement("a");a.href="tel:"+program.contact_phone.replace(/[^+\\d]/g,"");a.textContent=program.contact_phone;p.append("Téléphone : ",a);contact.append(p);}
    if(program.contact_email){const p=document.createElement("p");const a=document.createElement("a");a.href="mailto:"+program.contact_email;a.textContent=program.contact_email;p.append("E-mail : ",a);contact.append(p);}
    card.append(contact);
   }
   container.append(card);
  });
 }catch(error){console.error("Chargement de la catéchèse impossible :",error);showMessage(container,"Les informations sur la catéchèse sont momentanément indisponibles. Vérifiez la table et les autorisations de lecture dans Supabase.");}
}
loadCatechesisPrograms();

loadSacramentPages();

/* Galerie photos : lecture depuis Supabase. */
async function loadGalleryPhotos(){
  const categories={celebrations:"celebrationsSlideshow",fraternelles:"fraternellesSlideshow",communaute:"communauteSlideshow"};
  try{
    const response=await fetch(`${SUPABASE_URL}/rest/v1/gallery_photos?select=id,category,image_path,caption,created_at&order=created_at.desc`,{headers:supabaseHeaders});
    if(!response.ok)throw new Error(`Supabase ${response.status}: ${await response.text()}`);
    const photos=await response.json();
    Object.entries(categories).forEach(([category,containerId])=>{
      const container=document.getElementById(containerId);if(!container)return;
      const items=photos.filter(photo=>photo.category===category);container.replaceChildren();
      if(!items.length){const empty=document.createElement("p");empty.className="empty-message";empty.textContent="Aucune photo disponible pour le moment.";container.append(empty);return;}
      const slides=[];
      items.forEach((photo,index)=>{
        const slide=document.createElement("div");slide.className="celebration-slide"+(index===0?" is-active":"");
        const img=document.createElement("img");img.src=storagePublicUrl(photo.image_path);img.alt=photo.caption||"Photo de la vie paroissiale";img.loading="lazy";img.dataset.galleryZoom="true";
        img.onerror=()=>{slide.remove();console.error("Photo inaccessible :",photo.image_path);};slide.append(img);container.append(slide);slides.push(slide);
      });
      const controls=document.createElement("div");controls.className="celebrations-controls";
      const prev=document.createElement("button"),next=document.createElement("button");prev.type=next.type="button";prev.textContent="‹";next.textContent="›";
      prev.setAttribute("aria-label","Photo précédente");next.setAttribute("aria-label","Photo suivante");controls.append(prev,next);container.append(controls);
      const dots=document.createElement("div");dots.className="celebrations-dots";let current=0,timer=null;
      function show(index){current=(index+slides.length)%slides.length;slides.forEach((slide,i)=>slide.classList.toggle("is-active",i===current));[...dots.children].forEach((dot,i)=>dot.classList.toggle("is-active",i===current));}
      function stop(){if(timer)window.clearInterval(timer);timer=null;}
      function start(){stop();if(slides.length>1&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches)timer=window.setInterval(()=>show(current+1),4000);}
      slides.forEach((slide,index)=>{const dot=document.createElement("button");dot.type="button";dot.setAttribute("aria-label",`Afficher la photo ${index+1}`);if(index===0)dot.classList.add("is-active");dot.addEventListener("click",()=>{show(index);start();});dots.append(dot);});
      container.append(dots);prev.addEventListener("click",()=>{show(current-1);start();});next.addEventListener("click",()=>{show(current+1);start();});
      container.addEventListener("mouseenter",stop);container.addEventListener("mouseleave",start);container.addEventListener("focusin",stop);container.addEventListener("focusout",start);show(0);start();
    });
  }catch(error){console.error("Chargement de la galerie impossible :",error);Object.values(categories).forEach(id=>{const el=document.getElementById(id);if(el)showMessage(el,"La galerie est momentanément indisponible.");});}
}
loadGalleryPhotos();

/* Vidéos des rubriques : chorales, mouvements et ministères. */
async function loadParishSectionVideos(){
  const containers={
    chorales:document.getElementById("videos-chorales"),
    mouvements:document.getElementById("videos-mouvements"),
    ministeres:document.getElementById("videos-ministeres")
  };
  try{
    const sectionsResponse=await fetch(
      `${SUPABASE_URL}/rest/v1/parish_sections?select=id,section_key&is_published=eq.true&section_key=in.(chorales,mouvements,ministeres)`,
      {headers:supabaseHeaders}
    );
    if(!sectionsResponse.ok)throw new Error(`Lecture de parish_sections (${sectionsResponse.status}) : ${await sectionsResponse.text()}`);
    const sections=await sectionsResponse.json();

    // Une catégorie peut contenir plusieurs fiches : conserver tous leurs identifiants.
    const sectionIds={chorales:[],mouvements:[],ministeres:[]};
    sections.forEach(section=>{
      if(sectionIds[section.section_key])sectionIds[section.section_key].push(section.id);
    });
    const ids=Object.values(sectionIds).flat();
    if(!ids.length){
      Object.values(containers).forEach(container=>{if(container)showMessage(container,"Aucune rubrique publiée pour le moment.");});
      return;
    }

    const params=new URLSearchParams();
    params.set("select","id,section_id,video_path,title,description,display_order,created_at");
    params.set("section_id",`in.(${ids.join(",")})`);
    params.set("order","display_order.asc,created_at.desc");
    const videosResponse=await fetch(
      `${SUPABASE_URL}/rest/v1/parish_section_videos?${params.toString()}`,
      {headers:supabaseHeaders}
    );
    if(!videosResponse.ok)throw new Error(`Lecture de parish_section_videos (${videosResponse.status}) : ${await videosResponse.text()}`);
    const videos=await videosResponse.json();

    Object.entries(containers).forEach(([category,container])=>{
      if(!container)return;
      container.replaceChildren();
      const categoryIds=new Set(sectionIds[category].map(String));
      const sectionVideos=videos.filter(item=>categoryIds.has(String(item.section_id))&&item.video_path);
      if(!sectionVideos.length){
        const empty=document.createElement("p");empty.className="section-video-empty";empty.textContent="Aucune vidéo disponible pour le moment.";container.append(empty);return;
      }
      sectionVideos.forEach(item=>{
        const card=document.createElement("article");card.className="section-video-card";
        const player=document.createElement("video");player.controls=true;player.playsInline=true;player.preload="metadata";
        player.src=storagePublicUrl(item.video_path);player.setAttribute("aria-label",item.title||"Vidéo paroissiale");
        const title=document.createElement("h4");title.textContent=item.title||"Vidéo paroissiale";
        card.append(player,title);
        if(item.description){const description=document.createElement("p");description.textContent=item.description;card.append(description);}
        player.addEventListener("error",()=>console.error("Vidéo inaccessible ou chemin incorrect :",item.video_path));
        container.append(card);
      });
    });
  }catch(error){
    console.error("Chargement des vidéos paroissiales impossible :",error);
    Object.values(containers).forEach(container=>{if(container)showMessage(container,"Les vidéos sont momentanément indisponibles. Vérifiez les autorisations de lecture Supabase.");});
  }
}
loadParishSectionVideos();

/* Photos des rubriques : chorales, mouvements et ministères. */
async function loadParishSectionPhotos(){
  const containers={
    chorales:document.getElementById("photos-chorales"),
    mouvements:document.getElementById("photos-mouvements"),
    ministeres:document.getElementById("photos-ministeres")
  };
  try{
    const sectionsResponse=await fetch(
      `${SUPABASE_URL}/rest/v1/parish_sections?select=id,section_key&is_published=eq.true&section_key=in.(chorales,mouvements,ministeres)`,
      {headers:supabaseHeaders}
    );
    if(!sectionsResponse.ok)throw new Error(`Lecture des rubriques (${sectionsResponse.status}) : ${await sectionsResponse.text()}`);
    const sections=await sectionsResponse.json();

    // Une catégorie peut contenir plusieurs fiches : conserver tous leurs identifiants.
    const sectionIds={chorales:[],mouvements:[],ministeres:[]};
    sections.forEach(section=>{
      if(sectionIds[section.section_key])sectionIds[section.section_key].push(section.id);
    });
    const ids=Object.values(sectionIds).flat();
    if(!ids.length){
      Object.values(containers).forEach(container=>{if(container)showMessage(container,"Aucune rubrique publiée pour le moment.");});
      return;
    }

    const params=new URLSearchParams();
    params.set("select","id,section_id,photo_path,created_at");
    params.set("section_id",`in.(${ids.join(",")})`);
    params.set("order","created_at.desc");
    const photosResponse=await fetch(`${SUPABASE_URL}/rest/v1/parish_section_photos?${params.toString()}`,{headers:supabaseHeaders});
    if(!photosResponse.ok)throw new Error(`Lecture de parish_section_photos (${photosResponse.status}) : ${await photosResponse.text()}`);
    const photos=await photosResponse.json();

    Object.entries(containers).forEach(([category,container])=>{
      if(!container)return;
      container.replaceChildren();
      const categoryIds=new Set(sectionIds[category].map(String));
      const sectionPhotos=photos.filter(item=>categoryIds.has(String(item.section_id))&&item.photo_path);
      if(!sectionPhotos.length){
        const empty=document.createElement("p");empty.className="section-video-empty";empty.textContent="Aucune photo disponible pour le moment.";container.append(empty);return;
      }
      sectionPhotos.forEach(item=>{
        const card=document.createElement("div");card.className="section-photo-card";
        const img=document.createElement("img");img.src=storagePublicUrl(item.photo_path);img.alt=`Photo de ${category}`;img.loading="lazy";img.dataset.galleryZoom="true";
        img.addEventListener("error",()=>{console.error("Photo de rubrique inaccessible ou chemin incorrect :",item.photo_path);card.remove();});
        card.append(img);container.append(card);
      });
    });
  }catch(error){
    console.error("Chargement des photos des rubriques impossible :",error);
    Object.values(containers).forEach(container=>{if(container)showMessage(container,"Les photos sont momentanément indisponibles. Vérifiez les autorisations de lecture de parish_section_photos.");});
  }
}
loadParishSectionPhotos();

/* Saint du jour : calendrier Nominis. */
async function loadSaintDuJour(){
  const name=document.getElementById("saintModalName"),cardName=document.getElementById("saintCardName");
  const description=document.getElementById("saintDescription"),dateElement=document.getElementById("saintDateModal");
  const dateCard=document.getElementById("saintDate"),image=document.getElementById("saintImage");
  const modalImage=document.getElementById("saintModalImage"),imageButton=document.getElementById("saintImageButton");
  const modal=document.getElementById("saintModal"),closeButton=document.getElementById("closeSaintModal"),source=document.getElementById("saintSource");
  if(!name||!description||!image||!modal)return;
  const open=()=>{modal.classList.add("is-open");document.body.classList.add("modal-active");closeButton?.focus();};
  const close=()=>{modal.classList.remove("is-open");document.body.classList.remove("modal-active");imageButton?.focus();};
  imageButton?.addEventListener("click",open);closeButton?.addEventListener("click",close);
  modal.addEventListener("click",event=>{if(event.target===modal)close();});
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&modal.classList.contains("is-open"))close();});
  try{
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Abidjan",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()),p={};
    parts.forEach(x=>p[x.type]=x.value);
    const response=await fetch(`https://nominis.cef.fr/json/saintdujour.php?jour=${p.day}&mois=${p.month}&annee=${p.year}`);
    if(!response.ok)throw new Error("Service Nominis indisponible");
    const data=await response.json(),saint=data?.response?.saintdujour;if(!saint)throw new Error("Aucun saint disponible");
    name.textContent=saint.nom||"Saint du jour";if(cardName)cardName.textContent=saint.nom||"Saint du jour";
    const dateText=new Intl.DateTimeFormat("fr-FR",{dateStyle:"full",timeZone:"Africa/Abidjan"}).format(new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`));
    if(dateElement)dateElement.textContent=dateText;if(dateCard)dateCard.textContent=dateText;
    const doc=new DOMParser().parseFromString(saint.contenu||"","text/html");
    description.textContent=doc.body.textContent.replace(/\s+/g," ").trim()||saint.description||"Découvrez la vie de ce saint.";
    const saintImg=doc.querySelector("img"),imageSrc=saintImg?.getAttribute("src");
    if(imageSrc){const safeImageUrl=new URL(imageSrc,"https://nominis.cef.fr");if(safeImageUrl.hostname==="nominis.cef.fr"){image.src=safeImageUrl.href;image.alt=saintImg.alt||saint.nom||"Saint du jour";image.style.display="block";modalImage.src=safeImageUrl.href;modalImage.alt=image.alt;modalImage.style.display="block";image.onerror=()=>{image.style.display="none";};modalImage.onerror=()=>{modalImage.style.display="none";};}}
    else{image.style.display="none";modalImage.style.display="none";}
    if(saint.lien&&source){const u=new URL(saint.lien,"https://nominis.cef.fr");if(u.hostname==="nominis.cef.fr"){u.protocol="https:";source.href=u.href;}}
  }catch(error){console.error("Erreur Saint du jour :",error);name.textContent="Saint du jour indisponible";if(cardName)cardName.textContent="Saint du jour momentanément indisponible";description.textContent="Veuillez vérifier votre connexion Internet et réessayer.";if(dateCard)dateCard.textContent="Calendrier catholique";}
}
loadSaintDuJour();

/* Actualités : lecture des annonces publiées dans parish_announcements. */
async function loadParishAnnouncements(){
  const list=document.getElementById("announcementsList"),homeNews=document.getElementById("homeNews");if(!list)return;
  try{
    const endpoint=`${SUPABASE_URL}/rest/v1/parish_announcements?select=id,title,body,image_path,created_at,category&is_published=eq.true&order=created_at.desc`;
    const response=await fetch(endpoint,{headers:supabaseHeaders});if(!response.ok)throw new Error(`Erreur Supabase (${response.status}) : ${await response.text()}`);
    const announcements=await response.json();list.replaceChildren();if(homeNews)homeNews.replaceChildren();
    if(!announcements.length){
      const article=document.createElement("article");article.className="card announcement";const box=document.createElement("div");box.className="announcement-content";
      const h=document.createElement("h3");h.textContent="Aucune actualité pour le moment";const p=document.createElement("p");p.textContent="Les nouvelles de la paroisse seront publiées ici.";
      box.append(h,p);article.append(box);list.append(article);if(homeNews){const p2=document.createElement("p");p2.textContent="Aucune annonce récente. Revenez bientôt consulter les nouvelles de la paroisse.";homeNews.append(p2);}return;
    }
    announcements.forEach((item,index)=>{
      const article=document.createElement("article");article.className="card announcement";
      if(item.image_path){const img=document.createElement("img");img.src=storagePublicUrl(item.image_path);img.alt=item.title||"Actualité paroissiale";img.loading="lazy";img.onerror=()=>img.remove();article.append(img);}
      const box=document.createElement("div");box.className="announcement-content";const pill=document.createElement("span");pill.className="pill";pill.textContent=item.category||"Actualité paroissiale";
      const h=document.createElement("h3");h.textContent=item.title||"Actualité paroissiale";const p=document.createElement("p"),body=item.body||"";p.textContent=body.length>220?body.slice(0,220)+"…":body;
      const date=document.createElement("small");date.textContent=item.created_at?new Date(item.created_at).toLocaleDateString("fr-FR"):"";
      box.append(pill,h,p,date);article.append(box);list.append(article);
      if(homeNews&&index<2){const line=document.createElement("p");line.textContent=(item.title||"Actualité paroissiale")+(item.created_at?" · "+new Date(item.created_at).toLocaleDateString("fr-FR"):"");homeNews.append(line);}
    });
    const old=document.getElementById("newsControls");if(old)old.remove();
    if(announcements.length>1){const controls=document.createElement("div");controls.className="news-controls";controls.id="newsControls";const prev=document.createElement("button"),next=document.createElement("button");
      prev.type=next.type="button";prev.textContent="‹";next.textContent="›";prev.setAttribute("aria-label","Actualité précédente");next.setAttribute("aria-label","Actualité suivante");controls.append(prev,next);list.after(controls);
      const move=direction=>{const card=list.querySelector(".announcement");if(card)list.scrollBy({left:direction*(card.getBoundingClientRect().width+16),behavior:"smooth"});};
      prev.addEventListener("click",()=>move(-1));next.addEventListener("click",()=>move(1));
    }
  }catch(error){console.error("Chargement des actualités impossible :",error);showMessage(list,"Les actualités sont temporairement indisponibles. Vérifiez la connexion Supabase et les autorisations de lecture de parish_announcements.");if(homeNews)homeNews.textContent="Les actualités sont temporairement indisponibles.";}
}
loadParishAnnouncements();

/* Prêtres publiés dans l'administration. */
async function loadParishPriests(){
  const list=document.getElementById("priestsList");if(!list)return;
  try{
    const response=await fetch(`${SUPABASE_URL}/rest/v1/priests?select=id,full_name,function_title,photo_path,biography&is_published=eq.true&order=display_order.asc`,{headers:supabaseHeaders});
    if(!response.ok)throw new Error(`Erreur Supabase (${response.status}) : ${await response.text()}`);
    const priests=await response.json();list.replaceChildren();if(!priests.length){showMessage(list,"Les informations de nos prêtres seront bientôt disponibles.");return;}
    priests.forEach(priest=>{
      const card=document.createElement("article");card.className="card priest-card";
      if(priest.photo_path){const photo=document.createElement("img");photo.src=storagePublicUrl(priest.photo_path);photo.alt=priest.full_name||"Prêtre de la paroisse";photo.className="priest-photo";photo.loading="lazy";photo.onerror=()=>photo.remove();card.append(photo);}
      const info=document.createElement("div");info.className="priest-info";const h=document.createElement("h3");h.textContent=priest.full_name||"Nom non renseigné";
      const f=document.createElement("div");f.className="priest-function";f.textContent=priest.function_title||"";const p=document.createElement("p");p.className="priest-biography";p.textContent=priest.biography||"";
      info.append(h,f,p);card.append(info);list.append(card);
    });
  }catch(error){console.error("Chargement des prêtres impossible :",error);showMessage(list,"Les informations des prêtres sont temporairement indisponibles. Vérifiez les autorisations de lecture de la table priests.");}
}
loadParishPriests();

/* CEB : lecture publique de la colonne name de parish_cebs. */
async function loadParishCebs(){
  const list=document.getElementById("cebsList");if(!list)return;
  try{
    const response=await fetch(`${SUPABASE_URL}/rest/v1/parish_cebs?select=id,name&order=name.asc`,{headers:supabaseHeaders});
    if(!response.ok)throw new Error(`Erreur Supabase (${response.status}) : ${await response.text()}`);
    const cebs=await response.json();list.replaceChildren();const names=[...new Set(cebs.map(item=>String(item.name||"").trim()).filter(Boolean))];
    if(!names.length){showMessage(list,"Aucune CEB enregistrée pour le moment.");return;}
    names.forEach(value=>{const item=document.createElement("div");item.className="ceb-item";const symbol=document.createElement("span");symbol.className="ceb-symbol";symbol.textContent="✝";const p=document.createElement("p");p.className="ceb-name";p.textContent=value;item.append(symbol,p);list.append(item);});
  }catch(error){console.error("Chargement des CEB impossible :",error);showMessage(list,"Les communautés sont temporairement indisponibles. Vérifiez les autorisations de lecture (RLS) de parish_cebs dans Supabase.");}
}
loadParishCebs();

/* DONS PUBLICS : affichage des 4 derniers dons autorisés à être publiés. */
async function loadPublicDonations(){
  const list=document.getElementById("publicDonationsList");
  if(!list)return;

  list.replaceChildren();
  const loading=document.createElement("p");
  loading.className="donation-public-empty";
  loading.textContent="Chargement des dons…";
  list.append(loading);

  try{
    const endpoint=`${SUPABASE_URL}/rest/v1/public_donations?select=*&order=created_at.desc&limit=4`;
    const response=await fetch(endpoint,{headers:supabaseHeaders,cache:"no-store"});
    if(!response.ok)throw new Error(`Erreur Supabase (${response.status}) : ${await response.text()}`);

    const donations=await response.json();
    list.replaceChildren();

    if(!Array.isArray(donations)||donations.length===0){
      const empty=document.createElement("p");
      empty.className="donation-public-empty";
      empty.textContent="Aucun don public confirmé pour le moment. Merci pour votre soutien à la paroisse.";
      list.append(empty);
      return;
    }

    const track=document.createElement("div");
    track.className="donations-track";
    const firstGroup=document.createElement("div");
    firstGroup.className="donations-track-group";
    const secondGroup=document.createElement("div");
    secondGroup.className="donations-track-group";
    secondGroup.setAttribute("aria-hidden","true");

    donations.slice(0,4).forEach(donation=>{
      const makeCard=()=>{
        const item=document.createElement("article");
        item.className="donation-public-item";
        const details=document.createElement("div");

        const name=document.createElement("p");
        name.className="donation-public-name";
        name.textContent=donation.display_name||donation.donor_name||donation.name||"Un paroissien";

        const date=document.createElement("time");
        date.className="donation-public-date";
        if(donation.created_at){
          const parsedDate=new Date(donation.created_at);
          if(!Number.isNaN(parsedDate.getTime())){
            date.dateTime=parsedDate.toISOString();
            date.textContent=parsedDate.toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric",timeZone:"Africa/Abidjan"});
          }else{date.textContent="Date non renseignée";}
        }else{date.textContent="Date non renseignée";}

        const amount=document.createElement("div");
        amount.className="donation-public-amount";
        const numericAmount=Number(donation.amount);
        const formattedAmount=Number.isFinite(numericAmount)
          ?new Intl.NumberFormat("fr-FR",{maximumFractionDigits:2}).format(numericAmount)
          :String(donation.amount??"");
        const currency=String(donation.currency||"XOF").trim().toUpperCase();
        amount.textContent=[formattedAmount,currency==="XOF"?"FCFA":currency].filter(Boolean).join(" ");

        details.append(name,date);
        item.append(details,amount);
        return item;
      };
      firstGroup.append(makeCard());
      secondGroup.append(makeCard());
    });

    track.append(firstGroup,secondGroup);
    list.append(track);
  }catch(error){
    console.error("Chargement des dons publics impossible :",error);
    list.replaceChildren();
    const message=document.createElement("p");
    message.className="donation-public-empty";
    message.textContent="Les dons publics sont momentanément indisponibles. Veuillez réessayer plus tard.";
    list.append(message);
  }
}
loadPublicDonations();


/* Agrandissement des photos, y compris celles chargées depuis Supabase. */
(function(){
  const lightbox=document.createElement("div");lightbox.className="gallery-lightbox";lightbox.id="galleryLightbox";lightbox.setAttribute("role","dialog");lightbox.setAttribute("aria-modal","true");lightbox.setAttribute("aria-label","Photo agrandie");
  const enlarged=document.createElement("img");enlarged.alt="Photo agrandie de la paroisse";
  const close=document.createElement("button");close.type="button";close.className="gallery-lightbox-close";close.textContent="×";close.setAttribute("aria-label","Fermer la photo agrandie");lightbox.append(enlarged,close);document.body.append(lightbox);
  function hide(){lightbox.classList.remove("is-open");document.body.style.overflow="";}
  document.addEventListener("click",event=>{const img=event.target.closest("[data-gallery-zoom]");if(!img)return;enlarged.src=img.src;enlarged.alt=img.alt;lightbox.classList.add("is-open");document.body.style.overflow="hidden";close.focus();});
  close.addEventListener("click",hide);lightbox.addEventListener("click",event=>{if(event.target===lightbox)hide();});
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&lightbox.classList.contains("is-open"))hide();});
})();
