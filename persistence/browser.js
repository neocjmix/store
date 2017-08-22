/*
 * not tested!!
 */

function Local(store, path){
    const storeId = store.getId() + path;
    const persistedJSON = localStorage.getItem(storeId);
    if(persistedJSON){
        try{
            store.path(path).commit("restore from session Storage[" + storeId + "]", JSON.parse(persistedJSON));
        }catch(e){
            console.error(e);
        }

    }
    store.subscribe(path).then(function(data){
        try{
            localStorage.setItem(store.getId() + path, JSON.stringify(data) || null);
        }catch(e){
            console.error(e);
        }
    })
}

function Session(store, path){
    const storeId = store.getId() + path;
    const persistedJSON = sessionStorage.getItem(storeId);
    if(persistedJSON){
        try{
            store.path(path).commit("restore from session Storage[" + storeId + "]", JSON.parse(persistedJSON));
        }catch(e){
            console.error(e);
        }

    }
    store.subscribe(path).then(function(data){
        try{
            sessionStorage.setItem(store.getId() + path, JSON.stringify(data) || null);
        }catch(e){
            console.error(e);
        }
    })
}

export {
    Local,
    Session
}