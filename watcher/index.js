import './style.less'
import Store from '..'
import {Session} from '../persistence/browser'
import template from './watcher.hbs'
import jsonFormat from 'json-format'
import $ from 'jquery'

function Watcher(store, $container, $state, $index, $slider, $message, $toggleButton){
    let ignoreChange = false;
    const revisions = [];
    const watcherStore = Store("watcher["+ store.getId() +"]", {
        currentIndex : 0,
        revisions:[],
        live:true
    });

    Session(watcherStore, "visible");

    store.subscribe("")
        .then(function(revision){
            if(ignoreChange) return;
            revisions.push({
                message : this.message,
                state : revision
            });
            watcherStore.commit("store updated", {
                revisions : revisions.slice()
            });
        });

    watcherStore
        .subscribe("revisions", "currentIndex", "live")
        .silently()
        .then(function(revisions, currentIndex, live){
            $index.html(currentIndex);
            $state.html(jsonFormat(revisions[currentIndex].state || {}, {
                type: 'space',
                size: 2
            }));
            $message.html(revisions[currentIndex].message);
            $slider
                .attr("min", 0)
                .attr("max", revisions.length - 1)
                [0].value = currentIndex;

            if(live){
                $index.addClass("live");
                watcherStore.commit("keep live", {
                    currentIndex : revisions.length - 1
                });
            }else{
                $index.removeClass("live");
            }
        });

    watcherStore
        .subscribe("visible")
        .then(function(visible){
            if(visible){
                $container.addClass("on");
            }else{
                $container.removeClass("on");
            }

            $toggleButton.one('click', function(){
                watcherStore.commit("toggle visibility", {
                    visible : !visible
                });
            });
        });

    $slider.on("input", function(e){
        const currentIndex = e.target.value*1;
        const max = e.target.max*1;

        watcherStore.commit("revision slider input", {
            currentIndex : currentIndex,
            live : currentIndex === max
        });
    });

    $slider.on("change", function(e){
        ignoreChange = true;
        store.reset("go time travel", revisions[e.target.value].state);
        ignoreChange = false;
    });
}

export default function(store){
    const $container = $('<div id="store-watcher" />');
    $('body').append($container.html(template()));
    Watcher(store,
        $container,
        $container.find(".state"),
        $container.find(".current-index"),
        $container.find(".revision-selector"),
        $container.find(".commit-message"),
        $container.find(".toggle"));
}



