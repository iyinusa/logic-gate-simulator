/*jshint sub:true*/


/**
 * 
 * The **GraphicalEditor** is responsible for layout and dialog handling.
 * 
 * @author Andreas Herz
 */

var Application = Class.extend(
{

    /**
     * @constructor
     * 
     * @param {String} canvasId the id of the DOM element to use as paint container
     */
    init : function()
    {
        var _this = this;

        this.localStorage = [];
        this.loggedIn = false;

        try {
            if( 'localStorage' in window && window.localStorage !== null){
                this.localStorage = localStorage;
            }
        } catch(e) {

        }


        this.currentFileHandle= {
            title: "Untitled"+conf.fileSuffix
        };
        this.palette  = new Palette(this);
        this.view     = new View(this, "draw2dCanvas");
        this.filePane = new Files(this);
        this.loggedIn = false;

        $("#appLogin, .editorLogin").on("click", function(){_this.login();});
        $("#fileOpen, #editorFileOpen").on("click", function(){ _this.fileOpen(); });
        $("#fileNew").on("click", function(){_this.fileNew();});
        $("#fileSave, #editorFileSave").on("click", function(){ _this.fileSave();});
        $("#appHelp").on("click", function(){$("#leftTabStrip .gitbook").click();});
        $("#appAbout").on("click", function(){ $("#leftTabStrip .about").click();});

        // First check if a valid token is inside the local storage
        //
        this.autoLogin();

        /*
         * Replace all SVG images with inline SVG
         */
        $('img.svg').each(function(){
            var $img = $(this);
            var imgURL = $img.attr('src');

            jQuery.get(imgURL, function(data) {
                // Get the SVG tag, ignore the rest
                var $svg = $(data).find('svg');
                // Remove any invalid XML tags as per http://validator.w3.org
                $svg = $svg.removeAttr('xmlns:a');
                // Replace image with new SVG
                $img.replaceWith($svg);
            }, 'xml');

        });
    },


    login:function()
    {
        var _this = this;
        // store the current document and visible tab pane.
        // This will be restored after the login has been done
        //
        var id= $("#leftTabStrip .active").attr("id");
        this.localStorage["pane"]=id;
        var writer = new draw2d.io.json.Writer();
        writer.marshal(this.view, function (json, base64) {
            _this.localStorage["json"]=JSON.stringify(json, undefined,2);
            window.location.href=conf.backend.oauth;
        });
    },



    dump:function()
    {
        var writer = new draw2d.io.json.Writer();
        writer.marshal(this.view, function (json) {
            console.log(JSON.stringify(json, undefined,2));
        });
    },

    getParam: function( name )
    {
        name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
        var regexS = "[\\?&]"+name+"=([^&#]*)";
        var regex = new RegExp( regexS );
        var results = regex.exec( window.location.href );

        // the param isn'T part of the normal URL pattern...
        //
        if( results === null ) {
            // maybe it is part in the hash.
            //
            regexS = "[\\#]"+name+"=([^&#]*)";
            regex = new RegExp( regexS );
            results = regex.exec( window.location.hash );
            if( results === null ) {
                return null;
            }
        }

        return results[1];
    },

    fileNew: function(shapeTemplate)
    {
        $("#leftTabStrip .editor").click();
        this.currentFileHandle = {
            title: "Untitled"+conf.fileSuffix
        };
        this.view.clear();
        if(shapeTemplate){
            var reader = new Reader();
            reader.unmarshal(this.view, shapeTemplate);
        }
        this.view.centerDocument();
    },


    fileSave: function()
    {
        var _this = this;

        if(this.loggedIn!==true){
            this.loginFirstMessage();
            return;
        }

        new FileSave(this.currentFileHandle).show(this.view, function(){
            _this.filePane.render();
        });
    },


    fileOpen: function(name)
    {
        var _this = this;

        if(this.loggedIn!==true){
            this.loginFirstMessage();
            return;
        }

        var openByIdCallback = function(id){
            $.ajax({
                    url: conf.backend.file.get,
                    method: "POST",
                    xhrFields: {
                        withCredentials: true
                    },
                    data:{
                        id:id
                    }
                }
            ).done(function(content){
                _this.currentFileHandle.title=name;
                _this.view.clear();
                var reader = new Reader();
                reader.unmarshal(_this.view, content);
                _this.view.getCommandStack().markSaveLocation();
                _this.view.centerDocument();
            });
        };


        $("#leftTabStrip .editor").click();
        if(name){
            openByIdCallback(name);
        }
        else {
            new FileOpen(this.currentFileHandle).show(openByIdCallback);
        }
    },


    fileDelete: function(id, successCallback)
    {
        if(this.loggedIn!==true){
            this.loginFirstMessage();
            return;
        }

        $.ajax({
                url: conf.backend.file.del,
                method: "POST",
                xhrFields: {
                    withCredentials: true
                },
                data:{
                    id:id
                }
            }
        ).done(function(){
            successCallback();
        });
    },

    autoLogin:function()
    {
        var _this = this;
        $.ajax({
            url:conf.backend.isLoggedIn,
            xhrFields: {
                withCredentials: true
             },
            success:function(data){
                _this.setLoginStatus(data==="true");
            },
            error:function(){
                _this.setLoginStatus(false);
            }
        });
    },

    loginFirstMessage:function()
    {
        $("#appLogin").addClass("shake");
        window.setTimeout(function(){
            $("#appLogin").removeClass("shake");
        },500);
        $.bootstrapGrowl("You must first sign in to use this functionality", {
            type: 'danger',
            align: 'center',
            width: 'auto',
            allow_dismiss: false
        });
    },

    setLoginStatus:function(isLoggedIn)
    {
        var _this = this;
        this.loggedIn = isLoggedIn;
        if (this.loggedIn) {
            $(".notLoggedIn").removeClass("notLoggedIn");
            $("#editorgroup_login").hide();
            $("#editorgroup_fileoperations").show();
        }
        else{
            $(".notLoggedIn").addClass("notLoggedIn");
            $("#editorgroup_login").show();
            $("#editorgroup_fileoperations").hide();
        }

        this.filePane.render();

        var id = this.localStorage["pane"];
        if(!id){
            id = this.getParam("pane");
        }
        console.log(id);
        if(id){
            this.localStorage.removeItem("pane");
            window.setTimeout(function(){
                $("#"+id+" a").click();
                var json = this.localStorage["json"];
                _this.localStorage.removeItem("json");
                if(json){
                    window.setTimeout(function(){
                        _this.fileNew(json);
                    },200);
                }
            },100);
        }
    }
});

;
ConnectionRouter = draw2d.layout.connection.InteractiveManhattanConnectionRouter.extend({
    NAME: "ConnectionRouter",

    /**
     * @constructor
     * Creates a new Router object.
     *
     */
    init: function ()
    {
        this._super();

        this.setBridgeRadius(4);
        this.setVertexRadius(3);
    },

    onInstall: function(conn)
    {
        this._super.apply(this,arguments);
        conn.installEditPolicy(new ConnectionSelectionFeedbackPolicy());
    },

    /**
     * @method
     * Set the radius of the vertex circle.
     *
     * @param {Number} radius
     */
    setVertexRadius: function(radius)
    {
        this.vertexRadius=radius;

        return this;
    },

    /**
     * @method
     * Set the radius or span of the bridge. A bridge will be drawn if two connections are crossing and didn't have any
     * common port.
     *
     * @param {Number} radius
     */
    setBridgeRadius: function(radius)
    {
        this.bridgeRadius=radius;
        this.bridge_LR = [" r", 0.5, -0.5, radius-(radius/2), -(radius-radius/4), radius, -radius,radius+(radius/2), -(radius-radius/4), radius*2, "0 "].join(" ");
        this.bridge_RL = [" r", -0.5, -0.5, -(radius-(radius/2)), -(radius-radius/4), -radius, -radius,-(radius+(radius/2)), -(radius-radius/4), -radius*2, "0 "].join(" ");

        return this;
    },

    /**
     * @inheritdoc
     */
    x_paint: function(conn)
    {
        var _this = this;
        // get the intersections to the other connections
        //
        var intersectionsASC = conn.getCanvas().getIntersection(conn).sort("x");
        var intersectionsDESC= intersectionsASC.clone().reverse();

        var intersectionForCalc = intersectionsASC;

        // add a ArrayList of all added vertex nodes to the connection
        //
        if(typeof conn.vertexNodes!=="undefined" && conn.vertexNodes!==null){
            conn.vertexNodes.remove();
        }
        conn.vertexNodes = conn.canvas.paper.set();

        // ATTENTION: we cast all x/y coordinates to integer and add 0.5 to avoid subpixel rendering of
        //            the connection. The 1px or 2px lines look much clearer than before.
        //
        var ps = conn.getVertices();
        var p = ps.get(0);
        var path = [ "M", p.x, " ", p.y];

        var oldP = p;
        var bridgeWidth =  this.bridgeRadius;
        var bridgeCode  = null;

        var calc = function(ii, interP) {
            if (draw2d.shape.basic.Line.hit(5, oldP.x, oldP.y, p.x, p.y, interP.x, interP.y) === true) {
                // It is a vertex node..
                //
                if(conn.sharingPorts(interP.other)){
                    var other = interP.other;
                    var otherZ = other.getZOrder();
                    var connZ = conn.getZOrder();
                    if(connZ<otherZ){
                        var vertexNode=conn.canvas.paper.ellipse(interP.x,interP.y, _this.vertexRadius, _this.vertexRadius).attr({fill:conn.lineColor.hash()});
                        conn.vertexNodes.push(vertexNode);
                    }
                }
                // ..or a bridge. We draw only horizontal bridges. Just a design decision
                //
                else if ((p.y|0) === (interP.y|0)) {
                    path.push(" L", (interP.x - bridgeWidth), " ", interP.y);
                    path.push(bridgeCode);
                }
            }
        };

        for (var i = 1; i < ps.getSize(); i++) {
            p = ps.get(i);

            // line goes from right->left.
            if (oldP.x > p.x) {
                intersectionForCalc=intersectionsDESC;
                bridgeCode  = this.bridge_RL;
                bridgeWidth = -this.bridgeRadius;
            }
            // line goes from left->right
            else{
                intersectionForCalc=intersectionsASC;
                bridgeCode  = this.bridge_LR;
                bridgeWidth = this.bridgeRadius;
            }

            // bridge   => the connections didn't have a common port
            // vertex => the connections did have a common source or target port
            //
            intersectionForCalc.each(calc);

            path.push(" L", p.x, " ", p.y);
            oldP = p;
        }
        conn.svgPathString = path.join("");
    }
});
;
ConnectionSelectionFeedbackPolicy = draw2d.policy.line.OrthogonalSelectionFeedbackPolicy.extend({

    NAME: "ConnectionSelectionFeedbackPolicy",

    /**
     * @constructor
     * Creates a new Router object.
     *
     */
    init: function ()
    {
        this._super();
    },



    onRightMouseDown: function(conn, x, y, shiftKey, ctrlKey)
    {
        var segment = conn.hitSegment(x,y);

        if(segment===null){
            return;
        }

        // standard menu entry "split". It is always possible to split a connection
        //
        var items = { };

        // add/remove of connection segments is only possible in the edit mode
        //
        if(conn.getCanvas().isSimulationRunning()===false){
            items.split= {name: draw2d.Configuration.i18n.menu.addSegment};

            // "remove" a segment isn't always possible. depends from the router algorithm
            //
            if(conn.getRouter().canRemoveSegmentAt(conn, segment.index)){
                items.remove= {name: draw2d.Configuration.i18n.menu.deleteSegment};
            }
        }

        // add a probe label is always possible
        //
        var probeFigure = conn.getProbeFigure();
        if(probeFigure===null) {
            items.probe = {name: "Add Probe"};
        }
        else{
            items.unprobe = {name: "Remove Probe"};
        }

        $.contextMenu({
            selector: 'body',
            events:
            {
                hide: function(){ $.contextMenu( 'destroy' ); }
            },
            callback: $.proxy(function(key, options)
            {
                var originalVertices, newVertices ;

                switch(key){
                    case "remove":
                        // deep copy of the vertices of the connection for the command stack to avoid side effects
                        originalVertices = conn.getVertices().clone(true);
                        this.removeSegment(conn, segment.index);
                        newVertices = conn.getVertices().clone(true);
                        conn.getCanvas().getCommandStack().execute(new draw2d.command.CommandReplaceVertices(conn, originalVertices, newVertices));
                        break;

                    case "split":
                        // deep copy of the vertices of the connection for the command stack to avoid side effects
                        originalVertices = conn.getVertices().clone(true);
                        this.splitSegment(conn, segment.index, x, y);
                        newVertices = conn.getVertices().clone(true);
                        conn.getCanvas().getCommandStack().execute(new draw2d.command.CommandReplaceVertices(conn, originalVertices, newVertices));
                        break;

                    case "probe":
                        var text = prompt("Probe Signal Label");
                        if(text) {
                            var label = new ProbeFigure({text: text, stroke: 0, x: -20, y: -40});
                            var locator = new draw2d.layout.locator.ManhattanMidpointLocator();
                            label.installEditor(new draw2d.ui.LabelInplaceEditor());
                            conn.add(label, locator);
                        }
                        break;

                    case "unprobe":
                        conn.remove(conn.getProbeFigure());
                        break;
                    default:
                        break;
                }
            },this),
            x:x,
            y:y,
            items: items
        });
    }
});


;
var DropInterceptorPolicy = draw2d.policy.canvas.DropInterceptorPolicy.extend({

    NAME : "draw2d.policy.canvas.DropInterceptorPolicy",

    /**
     * @constructor
     *
     */
    init: function(attr, setter, getter)
    {
        this._super(attr, setter, getter);
    },


    /**
     * @method
     * Called if the user want connect a port with any kind draw2d.Figure.<br>
     * Return a non <b>null</b> value if the interceptor accept the connect event.<br>
     * <br>
     * It is possible to delegate the drop event to another figure if the policy
     * returns another figure. This is usefull if a figure want to accept a port
     * drop event and delegates this drop event to another port.<br>
     *
     *
     * @param {draw2d.Figure} connectInquirer the figure who wants connect
     * @param {draw2d.Figure} connectIntent the potential connect target
     *
     * @return {draw2d.Figure} the calculated connect intent or <b>null</b> if the interceptor uses the veto right
     */
    delegateTarget: function(connectInquirer, connectIntent)
    {
        // a composite accept any kind of figures exceptional ports
        //
        if(!(connectInquirer instanceof draw2d.Port) && connectIntent instanceof draw2d.shape.composite.StrongComposite){
            return connectIntent;
        }

        // Ports accepts only Ports as DropTarget
        //
        if(!(connectIntent instanceof draw2d.Port) || !(connectInquirer instanceof draw2d.Port)){
            return null;
        }

        // consider the max possible connections for this port
        //
        if(connectIntent.getConnections().getSize() >= connectIntent.getMaxFanOut()){
            return null;
        }

        // It is not allowed to connect two output ports
        if (connectInquirer instanceof draw2d.OutputPort && connectIntent instanceof draw2d.OutputPort) {
            return null;
        }

        // It is not allowed to connect two input ports
        if (connectInquirer instanceof draw2d.InputPort && connectIntent instanceof draw2d.InputPort) {
            return null;
        }

        // It is not possible to create a loop back connection at the moment.
        // Reason: no connection router implemented for this case
        if((connectInquirer instanceof draw2d.Port) && (connectIntent instanceof draw2d.Port)){
        //    if(connectInquirer === connectIntent){
         //       return null;
           // }
        }

        // redirect the dragEnter handling to the hybrid port
        //
        if((connectInquirer instanceof draw2d.Port) && (connectIntent instanceof draw2d.shape.node.Hub)) {
            return connectIntent.getHybridPort(0);
        }

        // return the connectTarget determined by the framework or delegate it to another
        // figure.
        return connectIntent;
    }

});

;
var EditEditPolicy = draw2d.policy.canvas.BoundingboxSelectionPolicy.extend({


    init:function()
    {
      this._super();
      this.mouseMoveProxy = $.proxy(this._onMouseMoveCallback, this);
      this.configIcon=null;
    },

    /**
     * @method
     * Called by the canvas if the user click on a figure.
     *
     * @param {draw2d.Figure} the figure under the click event. Can be null
     * @param {Number} mouseX the x coordinate of the mouse during the click event
     * @param {Number} mouseY the y coordinate of the mouse during the click event
     * @param {Boolean} shiftKey true if the shift key has been pressed during this event
     * @param {Boolean} ctrlKey true if the ctrl key has been pressed during the event
     *
     * @since 3.0.0
     */
    onClick: function(figure, mouseX, mouseY, shiftKey, ctrlKey)
    {
        // we only foreward the click-event to the MarkerFigure hich the user can show hide per
        // default
        // lt in the edit mode as well.
        if(figure instanceof MarkerFigure){
            this._super(figure, mouseX, mouseY, shiftKey, ctrlKey);
        }
    },

    onInstall:function(canvas)
    {
        this._super(canvas);
        var _this = this;

        // provide configuration menu if the mouse is close to a shape
        //
        canvas.on("mousemove", this.mouseMoveProxy);
    },


    onUninstall:function(canvas)
    {
        this._super(canvas);

        canvas.off(this.mouseMoveProxy);
    },


    onMouseUp: function(canvas, x,y, shiftKey, ctrlKey)
    {
        if(shiftKey ===true && this.mouseDownElement===null){
            var rx = Math.min(x, this.x);
            var ry = Math.min(y, this.y);
            var rh = Math.abs(y-this.y);
            var rw = Math.abs(x-this.x);
            var raftFigure = new Raft();
            raftFigure.attr({
                x:rx,
                y:ry,
                width:rw,
                height:rh,
                color:"#1c9bab"
            });
            canvas.add(raftFigure);
            this.boundingBoxFigure1.setCanvas(null);
            this.boundingBoxFigure1 = null;
            this.boundingBoxFigure2.setCanvas(null);
            this.boundingBoxFigure2 = null;
        }
        else{
            this._super(canvas, x, y, shiftKey, ctrlKey);
        }
    },

    _onMouseMoveCallback:function(emitter, event)
    {
        // there is no benefit to show decorations during Drag&Drop of an shape
        //
        if(this.mouseMovedDuringMouseDown===true){
            if(this.configIcon!==null) {
                this.configIcon.remove();
                this.configIcon = null;
            }
            return;
        }

        var hit = null;
        var _this = this;

        emitter.getFigures().each(function(index, figure){
            if(figure.hitTest(event.x,event.y, 30)){
                hit = figure;
                return false;
            }
        });

        if(hit!==null && hit.getParameterSettings().length>0){
            var pos = hit.getBoundingBox().getTopLeft();
            pos = emitter.fromCanvasToDocumentCoordinate(pos.x, pos.y);
            pos.y -=30;

            if(_this.configIcon===null) {
                _this.configIcon = $("<div class='ion-gear-a' id='configMenuIcon'></div>");
                $("body").append(_this.configIcon);
              //  FigureConfigDialog.hide();
                _this.configIcon.on("click",function(){
                    FigureConfigDialog.show(hit, pos);
                    _this.configFigure = hit;
                    if(_this.configIcon!==null) {
                        _this.configIcon.remove();
                        _this.configIcon = null;
                    }
                });
            }
            _this.configIcon.css({top: pos.y, left: pos.x, position:'absolute'});
        }
        else{
            if(_this.configIcon!==null) {
                var x=_this.configIcon;
                _this.configIcon = null;
                x.fadeOut(500, function(){ x.remove(); });
            }
        }
    }
});
;
/*jshint sub:true*/


/**
 * 
 * The **GraphicalEditor** is responsible for layout and dialog handling.
 * 
 * @author Andreas Herz
 */

var Files = Class.extend(
{

    /**
     * @constructor
     * 
     * @param {String} canvasId the id of the DOM element to use as paint container
     */
    init : function(app)
    {
        this.app = app;
        this.render();
    },

    render: function()
    {
        var _this = this;
        if(this.app.loggedIn!==true){
            return;
        }

        $.ajax({
            url:conf.backend.file.list ,
            xhrFields: {
                withCredentials: true
            },
            success:function(response) {
                var files = response.files;
                // sort the result
                // Directories are always on top
                //
                files.sort(function (a, b) {
                    if (a.type === b.type) {
                        if (a.id.toLowerCase() < b.id.toLowerCase())
                            return -1;
                        if (a.id.toLowerCase() > b.id.toLowerCase())
                            return 1;
                        return 0;
                    }
                    return 1;
                });

                var compiled = Hogan.compile(
                    '{{#files}}' +
                    '<div class="col-lg-3 col-md-4 col-xs-6 thumb">'+
                    '  <span class="ion-ios-close-outline deleteIcon"  data-toggle="confirmation"  data-id="{{id}}"></span>'+
                    '  <a class="thumbnail" data-id="{{id}}">'+
                    '    <img class="img-responsive" src="'+conf.backend.file.image+'?id={{id}}" data-id="{{id}}">'+
                    '    <h4 data-name="{{name}}">{{name}}</h4>'+
                    '  </a>'+
                    '</div>'+
                    '{{/files}}'
                );


                var output = compiled.render({
                    files: files
                });

                $("#files .container > .row").html(
                '<div class="col-lg-3 col-md-4 col-xs-6 thumbAdd">'+
                '    <div class="img-responsive ion-ios-plus-outline"></div>'+
                '    <h4>New File</h4>'+
                '</div>');

                $("#files .container > .row").append($(output));

                $("#files .container .deleteIcon").on("click", function(){
                    var $el = $(this);
                    var name =  $el.data("id");
                    app.fileDelete(name,function(){
                        var parent = $el.parent();
                        parent.hide('slow', function(){ parent.remove(); });
                    });
                });

                $("[data-toggle='confirmation']").popConfirm({
                    title: "Delete File?",
                    content: "",
                    placement: "bottom" // (top, right, bottom, left)
                });


                $("#files .container .thumbnail h4").on("click", function() {
                    var $el = $(this);
                    var name = $el.data("name");
                    var $replaceWith = $('<input type="input" class="filenameInplaceEdit" value="' + name + '" />');
                    $el.hide();
                    $el.after($replaceWith);
                    $replaceWith.focus();

                    var fire = function () {
                        var newName = $replaceWith.val();
                        if (newName !== "") {
                            // get the value and post them here
                            $.ajax({
                                    url: conf.backend.file.rename,
                                    method: "POST",
                                    xhrFields: { withCredentials: true},
                                    data:{
                                        from:name+conf.fileSuffix,
                                        to:newName+conf.fileSuffix
                                    }
                                }
                            ).done(function(){
                                $replaceWith.remove();
                                $el.html(newName);
                                $el.show();
                                $el.data("name", newName);
                                $(".thumb [data-id='"+name+conf.fileSuffix+"']").data("id",newName+conf.fileSuffix);
                            });

                        }
                        else {
                            // get the value and post them here
                            $replaceWith.remove();
                            $el.show();
                        }
                    };
                    $replaceWith.blur(fire);
                    $replaceWith.keypress(function (e) {
                        if (e.which === 13) {
                            fire();
                        }
                    });
                });

                $("#files .container .thumbnail img").on("click", function(){
                    var $el = $(this);
                    var name =  $el.data("id");
                    app.fileOpen(name);
                });

                $("#files .thumbAdd").on("click", function(){
                    new FileNew(_this.app).show();
                });
            }
        });
    }
});

;
/*jshint sub:true*/


/**
 * 
 * The **GraphicalEditor** is responsible for layout and dialog handling.
 * 
 * @author Andreas Herz
 */

var Palette = Class.extend(
{

    /**
     * @constructor
     * 
     * @param {String} canvasId the id of the DOM element to use as paint container
     */
    init : function(app)
    {
        var _this = this;

        var $grid = $("#paletteElements");

        $.getJSON(conf.shapes.url+ "index.json", function(data) {

            data.forEach(function (element){
                element.basename = element.name.split("_").pop();
            });

            var tmpl = $.templates("#shapeTemplate");
            var html = tmpl.render({
                shapesUrl :conf.shapes.url,
                shapes: data
            });

            $("#paletteElements").html(html);

            // Advanced filtering
            $('#filter').on('keyup change', function (event) {
                if(event.keyCode===27){
                    $('#filter').val("");
                }
                var val = this.value.toLowerCase();
                $grid.shuffle('shuffle', function ($el, shuffle) {
                    var text = $.trim($el.data("name")).toLowerCase();
                    if(text==="_request_")
                        return true;
                    return text.indexOf(val) !== -1;
                });
            });


            // Create the jQuery-Draggable for the palette -> canvas drag&drop interaction
            //
            $(".draw2d_droppable").draggable({
                appendTo:"body",
              //  stack:"body",
              //  zIndex: 27000,
                helper:"clone",
                drag: function(event, ui){
                    event = app.view._getEvent(event);
                    var pos = app.view.fromDocumentToCanvasCoordinate(event.clientX, event.clientY);
                    app.view.onDrag(ui.draggable, pos.getX(), pos.getY(), event.shiftKey, event.ctrlKey);
                },
                stop: function(e, ui){
                },
                start: function(e, ui){
                    $(ui.helper).addClass("shadow");
                }
            });

            $('.draw2d_droppable')
                .on('mouseover', function(){
                    $(this).parent().addClass('glowBorder');
                })
                .on('mouseout', function(){
                $(this).parent().removeClass('glowBorder');
            });

            // add the "+" to the palette
            //
            var requestUrl =conf.issues.url+'?title=Request for shape&body='+encodeURIComponent("Please add the description of the shape you request.\nWe try to implement it as soon as possible...");
            $("#paletteElements").append(
             '  <div data-name="_request_" class="mix col-md-6 pallette_item">'+
             '  <a href="'+requestUrl+'" target="_blank">'+
             '    <div class="request">'+
             '       <div class="icon ion-ios-plus-outline"></div>'+
             '       <div >Request a Shape</div>'+
             '   </div>'+
             '   </a>  '+
             '  </div>');

        //    $("#paletteElements").append("<div>++</div>");
        });

    }
});

;
var ProbeWindow = Class.extend({

    init:function(canvas)
    {
        var _this = this;
        this.canvas = canvas;

        // sync the setting in the local storage
        this.stick = Locstor.get("stickWindow",false);
        this.watch("stick",function(id, oldval, newval){
            Locstor.set("stickWindow",newval);
            return newval;
        });

        // the tick function if the oszi goes from left to the right
        //
        this.rightShiftTick= $.proxy(function(entry){
            entry.data.unshift(entry.probe.getValue()?5:0);
            entry.vis
                .selectAll("path")
                .attr("transform", "translate(-" + _this.xScale(1) + ")")
                .attr("d", entry.path)
                .transition()
                .ease("linear")
                .duration(this.intervalTime )
                .attr("transform", "translate(0)");
                entry.data.pop();
        },this);

        this.leftShiftTick= $.proxy(function(entry){
            entry.data.push(entry.probe.getValue()?5:0);
            entry.vis
                .selectAll("path")
                .attr("transform", "translate(" + _this.xScale(1) + ")")
                .attr("d", entry.path)
                .transition()
                .ease("linear")
                .duration(this.intervalTime )
                .attr("transform", "translate(0)");
            entry.data.shift();
        },this);


        $(window).resize(function(){
            _this.resize();
        });

        this.canvas.on("probe:add", function(emitter, event){
           _this.addProbe(event.figure);
        });
        this.canvas.on("probe:remove", function(emitter, event){
            _this.removeProbe(event.figure);
        });

        this.channelBufferSize = 500;
        this.channelHeight =20;
        this.channelWidth = $("#probe_window").width();
        this.probes = [];

        this.xScale = d3.scale.linear().domain([0, this.channelBufferSize - 1]).range([0,this.channelWidth]);
        this.yScale = d3.scale.linear().domain([0, 5]).range([this.channelHeight, 0]);

        $("#probe_window_stick").on("click",function(){
            _this.stick = !_this.stick;
            if(_this.stick){
                $("#probe_window_stick").addClass("ion-ios-eye").removeClass("ion-ios-eye-outline");
            }
            else{
                $("#probe_window_stick").addClass("ion-ios-eye-outline").removeClass("ion-ios-eye");
            }

            // try to hide the window if the simulation isn't running.
            if(!_this.stick && !_this.canvas.isSimulationRunning()){
                _this.hide();
            }
        });

        if(this.stick){
            $("#probe_window_stick").addClass("ion-ios-eye").removeClass("ion-ios-eye-outline");
            this.show(true);
        }
    },

    show:function(force)
    {
        if(!force && this.stick){
            return;
        }

        var _this = this;
        var probes = [];

        this.resize();

        // get all probes from the canvas and add them to the window
        //
        this.canvas.getLines().each(function(i,line){
            var probe = line.getProbeFigure();
            if(probe!==null){
                probes.push(probe);
            }
        });


        // sort the probes by the "index" attribute
        //
        probes.sort(function(a,b){
            return a.index - b.index;
        });

        $("#probeSortable").remove();
        $("#probe_window").append('<ul id="probeSortable"></ul>');


        probes.forEach(function(probe){
            _this.addProbe(probe);
        });

        if(probes.length>0)$("#probe_hint").hide(); else $("#probe_hint").show();
        $("#probe_window").show().animate({height:'200px'},300);
        $("#draw2dCanvasWrapper").animate({bottom:'200px'},300);
        $( "#probeSortable" ).sortable({
            update: function( event, ui ) {
                var lis =  $( "#probeSortable li" );
                $.each(lis,function(index, li){
                    probeEntry = _this.probes.find(function(entry){
                        return entry.probe.id===li.attributes.id.value;
                    });
                    probeEntry.probe.setIndex(index);
                });
            }
        });

    },

    hide:function()
    {
        if(this.stick){
            return;
        }

        $("#probe_window").animate({height:'0'},300);
        $("#draw2dCanvasWrapper").animate({bottom:'0'},300, function(){
            $("#probeSortable").remove();
        });
    },

    resize:function()
    {
        var _this = this;
        this.channelWidth = $("#probe_window").width();
        this.xScale = d3.scale.linear().domain([0, this.channelBufferSize - 1]).range([0,this.channelWidth]);
        this.yScale = d3.scale.linear().domain([0, 5]).range([this.channelHeight, 0]);

        this.probes.forEach(function(entry){
            entry.svg.attr("width", _this.channelWidth);
        });
    },

    tick:function( intervalTime)
    {
       // test fiddle for D3 line chart
       // http://jsfiddle.net/Q5Jag/1859/

       this.intervalTime = intervalTime;
       this.probes.forEach(this.leftShiftTick);
    },

    removeProbe: function(probeFigure)
    {
        this.probes = $.grep(this.probes, function(entry) {
            return entry.probe != probeFigure;
        });
        $("#"+probeFigure.id).remove();
        this.resize();
        if(this.probes.length>0)$("#probe_hint").fadeOut(); else $("#probe_hint").fadeIn();
    },

    addProbe: function(probeFigure)
    {
        probeFigure.setIndex(this.probes.length);

        var _this = this;

        var data = d3.range(this.channelBufferSize).map(function(){return 0;});

        var li    = d3.select("#probeSortable").append("li").attr("id",probeFigure.id).attr("index",probeFigure.getIndex());
        var label = li.append("div").text(probeFigure.getText());

        var svg   = li.append("svg:svg").attr("width", this.channelWidth).attr("height", this.channelHeight);
        var vis   = svg.append("svg:g");
        var path  = d3.svg
            .line()
            .x(function(d, i) {
                return _this.xScale(i);
            })
            .y(function(d, i) {
                return _this.yScale(d);
            })
            .interpolate("step-before");

        vis.selectAll("path")
            .data([data])
            .enter()
            .append("svg:path")
            .attr("d", path)
            .attr('stroke', 'green')
            .attr('stroke-width', 1)
            .attr('fill', 'none');

        this.probes.push({
            data: data,
            svg:svg,
            vis : vis,
            path:path,
            probe:probeFigure
        });
        if(this.probes.length>0)$("#probe_hint").hide(); else $("#probe_hint").show();

        // direct edit of the label
        //
        var $label = $(label[0]);
        $label.click(function() {

            var $replaceWith = $('<input type="input" class="inplaceEdit" value="'+probeFigure.getText()+'" />');
            $label.hide();
            $label.after($replaceWith);
            $replaceWith.focus();

            var fire=function() {
                var newLabel = $replaceWith.val();
                if(newLabel!=="") {
                    $replaceWith.remove();
                    $label.html(newLabel);
                    $label.show();
                    probeFigure.setText(newLabel);
                }
                else{
                    // get the value and post them here
                    $replaceWith.remove();
                    $label.show();
                }
            };
            $replaceWith.blur(fire);
            $replaceWith.keypress(function (e) {
                if (e.which == 13) {
                    fire();
                }
            });
        });
        this.resize();
    }
});

;
var SimulationEditPolicy = draw2d.policy.canvas.ReadOnlySelectionPolicy.extend({


    init:function()
    {
        this._super();
        this.mouseDownElement=null;
    },


    onInstall:function(canvas)
    {
        canvas.getFigures().each(function(index , shape){
            shape.onStart();
        });
    },


    onUninstall:function(canvas)
    {
        canvas.getFigures().each(function(index , shape){
            shape.onStop();
        });
    },

    /**
     * @method
     *
     * @param {draw2d.Canvas} canvas
     * @param {Number} x the x-coordinate of the mouse down event
     * @param {Number} y the y-coordinate of the mouse down event
     * @param {Boolean} shiftKey true if the shift key has been pressed during this event
     * @param {Boolean} ctrlKey true if the ctrl key has been pressed during the event
     */
    onMouseDown: function(canvas, x, y, shiftKey, ctrlKey) {
       var figure = canvas.getBestFigure(x, y);

        // may the figure is assigned to a composite. In this case the composite can
        // override the event receiver
        while (figure !== null) {
            var delegated = figure.getSelectionAdapter()();
            if (delegated === figure) {
                break;
            }
            figure = delegated;
        }

        // ignore ports since version 6.1.0. This is handled by the ConnectionCreatePolicy
        //
        if (figure instanceof draw2d.Port) {
            return;// silently
        }

        this.mouseDownElement = figure;

        if (this.mouseDownElement !== null) {
            this.mouseDownElement.fireEvent("mousedown", {x: x, y: y, shiftKey: shiftKey, ctrlKey: ctrlKey});
        }
    },

    /**
     * @method
     *
     * @param {draw2d.Canvas} canvas
     * @param {Number} x the x-coordinate of the mouse down event
     * @param {Number} y the y-coordinate of the mouse down event
     * @param {Boolean} shiftKey true if the shift key has been pressed during this event
     * @param {Boolean} ctrlKey true if the ctrl key has been pressed during the event
     */
    onMouseUp: function(canvas, x,y, shiftKey, ctrlKey)
    {
        if(this.mouseDownElement!==null){
            this.mouseDownElement.fireEvent("mouseup", {x:x, y:y, shiftKey:shiftKey, ctrlKey:ctrlKey});
        }
        this.mouseDownElement = null;
    },


    /**
     * @method
     * Called by the canvas if the user click on a figure.
     *
     * @param {draw2d.Figure} the figure under the click event. Can be null
     * @param {Number} mouseX the x coordinate of the mouse during the click event
     * @param {Number} mouseY the y coordinate of the mouse during the click event
     * @param {Boolean} shiftKey true if the shift key has been pressed during this event
     * @param {Boolean} ctrlKey true if the ctrl key has been pressed during the event
     *
     * @since 3.0.0
     */
    onClick: function(figure, mouseX, mouseY, shiftKey, ctrlKey)
    {
        if(figure!==null){
            figure.fireEvent("click", {
                figure:figure,
                x:mouseX,
                y:mouseY,
                relX: mouseX-figure.getAbsoluteX(),
                relY: mouseY-figure.getAbsoluteY(),
                shiftKey:shiftKey,
                ctrlKey:ctrlKey});

            figure.onClick();
        }
    }
});
;
/*jshint sub:true*/
/*jshint evil:true */


/**
 * 
 * The **GraphicalEditor** is responsible for layout and dialog handling.
 * 
 * @author Andreas Herz
 */


var View = draw2d.Canvas.extend({

    init:function(app, id)
    {
        var _this = this;

        this._super(id, 6000,6000);

        this.probeWindow = new ProbeWindow(this);

        this.simulate = false;
        this.animationFrameFunc = $.proxy(this._calculate,this);


        this.timerBase = 10; // ms calculate every 10ms all elements

        this.setScrollArea("#draw2dCanvasWrapper");

        // register this class as event listener for the canvas
        // CommandStack. This is required to update the state of
        // the Undo/Redo Buttons.
        //
        this.getCommandStack().addEventListener(this);

        var router = new ConnectionRouter();
        router.abortRoutingOnFirstVertexNode=false;
        var createConnection=function(sourcePort, targetPort){
            var c = new Connection({
                color:"#000000",
                router: router,
                stroke:1.5,
                radius:2
            });
            if(sourcePort) {
                c.setSource(sourcePort);
                c.setTarget(targetPort);
            }
            return c;
        };

        this.installEditPolicy( new DropInterceptorPolicy());

        // install a Connection create policy which matches to a "circuit like"
        // connections
        //
        this.connectionPolicy = new draw2d.policy.connection.ComposedConnectionCreatePolicy(
                [
                    // create a connection via Drag&Drop of ports
                    //
                    new draw2d.policy.connection.DragConnectionCreatePolicy({
                        createConnection:createConnection
                    }),
                    // or via click and point
                    //
                    new draw2d.policy.connection.OrthogonalConnectionCreatePolicy({
                        createConnection:createConnection
                    })
                ]);
        this.installEditPolicy(this.connectionPolicy);

        // show the ports of the elements only if the mouse cursor is close to the shape.
        //
        this.coronaFeedback = new draw2d.policy.canvas.CoronaDecorationPolicy({diameterToBeVisible:50});
        this.installEditPolicy(this.coronaFeedback);

        // nice grid decoration for the canvas paint area
        //
        this.grid =  new draw2d.policy.canvas.ShowGridEditPolicy(20);
        this.installEditPolicy( this.grid);

        // add some SnapTo policy for better shape/figure alignment
        //
        this.installEditPolicy( new draw2d.policy.canvas.SnapToGeometryEditPolicy());
        this.installEditPolicy( new draw2d.policy.canvas.SnapToCenterEditPolicy());
        this.installEditPolicy( new draw2d.policy.canvas.SnapToInBetweenEditPolicy());

        this.installEditPolicy(new EditEditPolicy());

        // Enable Copy&Past for figures
        //
        Mousetrap.bind(['ctrl+c', 'command+c'], $.proxy(function (event) {
            var primarySelection = this.getSelection().getPrimary();
            if(primarySelection!==null){
                this.clippboardFigure = primarySelection.clone({excludePorts:true});
                this.clippboardFigure.translate(5,5);
            }
            return false;
        },this));
        Mousetrap.bind(['ctrl+v', 'command+v'], $.proxy(function (event) {
            if(this.clippboardFigure!==null){
                var cloneToAdd = this.clippboardFigure.clone({excludePorts:true});
                var command = new draw2d.command.CommandAdd(this, cloneToAdd, cloneToAdd.getPosition());
                this.getCommandStack().execute(command);
                this.setCurrentSelection(cloneToAdd);
            }
            return false;
        },this));


        Mousetrap.bind(['left'],function (event) {
            var diff = _this.getZoom()<0.5?0.5:1;
            _this.getSelection().each(function(i,f){f.translate(-diff,0);});
            return false;
        });
        Mousetrap.bind(['up'],function (event) {
            var diff = _this.getZoom()<0.5?0.5:1;
            _this.getSelection().each(function(i,f){f.translate(0,-diff);});
            return false;
        });
        Mousetrap.bind(['right'],function (event) {
            var diff = _this.getZoom()<0.5?0.5:1;
            _this.getSelection().each(function(i,f){f.translate(diff,0);});
            return false;
        });
        Mousetrap.bind(['down'],function (event) {
            var diff = _this.getZoom()<0.5?0.5:1;
            _this.getSelection().each(function(i,f){f.translate(0,diff);});
            return false;
        });


        var setZoom = function(newZoom){
            var bb = _this.getBoundingBox().getCenter();
            var c = $("#draw2dCanvasWrapper");
            _this.setZoom(newZoom);
            _this.scrollTo((bb.y/newZoom- c.height()/2), (bb.x/newZoom- c.width()/2));
        };

        //  ZoomIn Button and the callbacks
        //
        $("#canvas_zoom_in").on("click",function(){
            setZoom(_this.getZoom()*1.2);
        });

        // OneToOne Button
        //
        $("#canvas_zoom_normal").on("click",function(){
            setZoom(1.0);
        });

        //ZoomOut Button and the callback
        //
        $("#canvas_zoom_out").on("click",function(){
            setZoom(_this.getZoom()*0.8);
        });


        $(".toolbar").delegate("#editDelete:not(.disabled)","click", function(){
            var selection = _this.getSelection();
            _this.getCommandStack().startTransaction(draw2d.Configuration.i18n.command.deleteShape);
            selection.each(function(index, figure){

                // Don't delete the conection if the source or target node part of the
                // selection. In this case the nodes deletes all connections by itself.
                //
                if(figure instanceof draw2d.Connection){
                    if(selection.contains(figure.getSource().getRoot()) || selection.contains(figure.getTarget().getRoot())){
                       return;
                    }
                }

                var cmd = figure.createCommand(new draw2d.command.CommandType(draw2d.command.CommandType.DELETE));
                if(cmd!==null){
                    _this.getCommandStack().execute(cmd);
                }
            });
            // execute all single commands at once.
            _this.getCommandStack().commitTransaction();
        });


        $(".toolbar").delegate("#editUndo:not(.disabled)","click", function(){
            _this.getCommandStack().undo();
        });

        $(".toolbar").delegate("#editRedo:not(.disabled)","click", function(){
            _this.getCommandStack().redo();
        });

        $("#simulationStartStop").on("click", function(){
            _this.simulationToggle();
        });


        // Register a Selection listener for the state hnadling
        // of the Delete Button
        //
        this.on("select", function(emitter, event){
            if(event.figure===null ) {
                $("#editDelete").addClass("disabled");
            }
            else{
                $("#editDelete").removeClass("disabled");
            }
        });

        this.on("contextmenu", function(emitter, event){
            var figure = _this.getBestFigure(event.x, event.y);

            // a connectionprovides its own context menu
            //
            if(figure instanceof draw2d.Connection){
                return;
            }
            if(figure instanceof ProbeFigure){
                return;
            }

            if(figure!==null){
                var x = event.x;
                var y = event.y;

                var pathToFile   = "https://github.com/freegroup/draw2d_js.shapes/blob/master/"+ eval(figure.NAME+".github");
                var pathToMD     = conf.shapes.url+figure.NAME+".md";
                var pathToCustom = conf.shapes.url+figure.NAME+".custom";
                var pathToDesign = conf.designer.url+"#file="+ figure.NAME+".shape";
                var items = {
                    "label":   {name: "Add Label"        , icon :"x ion-ios-pricetag-outline"     },
                    "delete":  {name: "Delete"           , icon :"x ion-ios-close-outline"        },
                    "sep1":    "---------",
                    "design":  {name: "Open Designer"    , icon :"x ion-ios-compose-outline"      },
                    "bug":     {name: "Report Bug"       , icon :"x ion-social-github"            },
                    "help":    {name: "Help"             , icon :"x ion-ios-information-outline"  }
                };

                // if the designer is running on the Raspi
                //
                if(conf.designer.url===null){
                     items = {
                        "label":   {name: "Add Label"        , icon :"x ion-ios-pricetag-outline"     },
                        "delete":  {name: "Delete"           , icon :"x ion-ios-close-outline"        },
                        "sep1":    "---------",
                        "help":    {name: "Help"             , icon :"x ion-ios-information-outline"  }
                     };
                }

                $.contextMenu({
                    selector: 'body',
                    events:
                    {
                        hide:function(){ $.contextMenu( 'destroy' ); }
                    },
                    callback: $.proxy(function(key, options)
                    {
                        switch(key){
                            case "code":
                                $.get(pathToCustom, function(content){
                                    new CodeDialog().show(content);
                                });
                                break;
                            case "label":
                                var text = prompt("Label");
                                if(text) {
                                    var label = new draw2d.shape.basic.Label({text:text, stroke:0, x:-20, y:-40});
                                    var locator = new draw2d.layout.locator.SmartDraggableLocator();
                                    label.installEditor(new draw2d.ui.LabelInplaceEditor());
                                    figure.add(label,locator);
                                }
                                break;
                            case "design":
                                window.open(pathToDesign);
                                break;
                            case "help":
                                $.get(pathToMD, function(content){
                                    new MarkdownDialog().show(content);
                                });
                                break;
                            case "bug":
                                var createUrl = conf.issues.url+"?title=Error in shape '"+figure.NAME+"'&body="+encodeURIComponent("I found a bug in "+figure.NAME+".\n\nError Description here...\n\n\nLinks to the code;\n[GitHub link]("+pathToFile+")\n[Designer Link]("+pathToDesign+")\n");
                                window.open(createUrl);
                                break;
                            case "delete":
                                var cmd = new draw2d.command.CommandDelete(figure);
                                _this.getCommandStack().execute(cmd);
                                break;
                            default:
                                break;
                        }

                    },this),
                    x:x,
                    y:y,
                    items:items

                });
            }
        });

        // hide the figure configuration dialog if the user clicks inside the canvas
        //
        this.on("click", function(){
            $("#figureConfigDialog").hide();
        });

        this.slider= $('#simulationBaseTimer')
            .slider({
                id:"simulationBaseTimerSlider"
            })
            .on("slide",function(event){
                // min = 50     => 100ms
                // norm= 100    => 10ms ticks
                // max = 500    =>  2ms ticks
                //
                // To map between the different intervals
                // [A, B] --> [a, b]
                // use this formula
                // (val - A)*(b-a)/(B-A) + a

                if(event.value<100){
                    _this.timerBase = parseInt(100-((event.value-50)*(100-10)/(100-50)+10));
                }
                else{
                    _this.timerBase = parseInt(11-((event.value-100)*(10-2)/(500-100)+2));
                }
            });

        // force focus for the searchbox in the object palette
        //
        /*
        setInterval(function(){
            // force only the focus if the editor tab pane is visible
            if(!$("#editor").hasClass("active")){
                return;
            }

            // fore only the focus if the "filter" input element the one and only visible
            // input field
            //
            if($("input:visible").length>1){
                return;
            }

            document.getElementById("filter").focus();
        },10);
        */


        socket.on('disconnect',function(){
            $(".raspiConnection").fadeIn();
        });

        socket.on('connect',function(){
            $(".raspiConnection").fadeOut();
        });
    },

    isSimulationRunning:function()
    {
        return this.simulate;
    },

    /**
     * @method
     * Clear the canvas and stop the simulation. Be ready for the next clean circuit
     * load. Start from the beginning
     */
    clear: function()
    {
        this.simulationStop();

        this._super();

        this.centerDocument();
    },

    /**
     * Disable snapTo GRID if we have select more than one element
     * @param figure
     * @param pos
     */
    snapToHelper : function(figure, pos)
    {
        if(this.getSelection().getSize()>1){
            return pos;
        }
        return this._super(figure, pos);
    },

    /**
     * @method
     * Called if the user drop the droppedDomNode onto the canvas.<br>
     * <br>
     * Draw2D use the jQuery draggable/droppable lib. Please inspect
     * http://jqueryui.com/demos/droppable/ for further information.
     *
     * @param {HTMLElement} droppedDomNode The dropped DOM element.
     * @param {Number} x the x coordinate of the drop
     * @param {Number} y the y coordinate of the drop
     * @param {Boolean} shiftKey true if the shift key has been pressed during this event
     * @param {Boolean} ctrlKey true if the ctrl key has been pressed during the event
     * @private
     **/
    onDrop : function(droppedDomNode, x, y, shiftKey, ctrlKey)
    {
        var type = $(droppedDomNode).data("shape");
        var figure = eval("new "+type+"();"); // jshint ignore:line
        // create a command for the undo/redo support
        var command = new draw2d.command.CommandAdd(this, figure, x, y);
        this.getCommandStack().execute(command);
    },

    simulationToggle:function()
    {
        if(this.simulate===true){
            this.simulationStop();
        } else {
            this.simulationStart();
        }
    },

    simulationStart:function()
    {
        if(this.simulate===true){
            return; // silently
        }

        this.simulate=true;

        this.installEditPolicy(new SimulationEditPolicy());
        this.uninstallEditPolicy(this.connectionPolicy);
        this.uninstallEditPolicy(this.coronaFeedback);
        this.commonPorts.each(function(i,p){
            p.setVisible(false);
        });

        this._calculate();

        $("#simulationStartStop").addClass("pause");
        $("#simulationStartStop").removeClass("play");
        $(".simulationBase" ).fadeIn( "slow" );
        $("#paletteElementsOverlay" ).fadeIn( "fast" );
        $("#paletteElementsOverlay").height($("#paletteElements").height());
        this.slider.slider("setValue",100);

        this.probeWindow.show();
    },

    simulationStop:function()
    {
        this.simulate = false;
        this.commonPorts.each(function(i,p){
            p.setVisible(true);
        });
        this.installEditPolicy(new EditEditPolicy());
        this.installEditPolicy(this.connectionPolicy);
        this.installEditPolicy(this.coronaFeedback);

        $("#simulationStartStop").addClass("play");
        $("#simulationStartStop").removeClass("pause");
        $(".simulationBase" ).fadeOut( "slow" );
        $("#paletteElementsOverlay" ).fadeOut( "fast" );
        this.probeWindow.hide();
    },

    _calculate:function()
    {
        // call the "calculate" method if given to calculate the output-port values
        //
        this.getFigures().each(function(i,figure){
            figure.calculate();
        });

        // transport the value from oututPort to inputPort
        //
        this.getLines().each(function(i,line){
            var outPort = line.getSource();
            var inPort  = line.getTarget();
            inPort.setValue(outPort.getValue());
            line.setColor(outPort.getValue()?conf.color.high:conf.color.low);
        });

        if(this.simulate===true){
       //     setImmediate(this.animationFrameFunc);
            setTimeout(this.animationFrameFunc,this.timerBase);
        }

        this.probeWindow.tick(this.timerBase);
    },

    /**
     * @method
     * Sent when an event occurs on the command stack. draw2d.command.CommandStackEvent.getDetail()
     * can be used to identify the type of event which has occurred.
     *
     * @template
     *
     * @param {draw2d.command.CommandStackEvent} event
     **/
    stackChanged:function(event)
    {
        $("#editUndo").addClass("disabled");
        $("#editRedo").addClass("disabled");

        if(event.getStack().canUndo()) {
            $("#editUndo").removeClass("disabled");
        }

        if(event.getStack().canRedo()) {
            $("#editRedo").removeClass("disabled");
        }

    },

    getBoundingBox: function()
    {
        var xCoords = [];
        var yCoords = [];
        this.getFigures().each(function(i,f){
           var b = f.getBoundingBox();
            xCoords.push(b.x, b.x+b.w);
            yCoords.push(b.y, b.y+b.h);
        });
        var minX   = Math.min.apply(Math, xCoords);
        var minY   = Math.min.apply(Math, yCoords);
        var width  = Math.max(100,Math.max.apply(Math, xCoords)-minX);
        var height = Math.max(100,Math.max.apply(Math, yCoords)-minY);

        return new draw2d.geo.Rectangle(minX,minY,width,height);
    },


    centerDocument:function()
    {
        var bb=null;
        var c = $("#draw2dCanvasWrapper");
        if(this.getFigures().getSize()>0){
            // get the bounding box of the document and translate the complete document
            // into the center of the canvas. Scroll to the top left corner after them
            //
            bb = this.getBoundingBox();
            this.scrollTo(bb.y- c.height()/2,bb.x- c.width()/2);
        }
        else{
            bb={
                x:this.getWidth()/2,
                y:this.getHeight()/2
            };
            this.scrollTo(bb.y- c.height()/2,bb.x- c.width()/2);

        }
    },

    /**
     * @method
     * Transforms a document coordinate to canvas coordinate.
     *
     * @param {Number} x the x coordinate relative to the window
     * @param {Number} y the y coordinate relative to the window
     *
     * @returns {draw2d.geo.Point} The coordinate in relation to the canvas [0,0] position
     */
    fromDocumentToCanvasCoordinate: function(x, y)
    {
        return new draw2d.geo.Point(
            (x - this.getAbsoluteX())*this.zoomFactor,
            (y - this.getAbsoluteY())*this.zoomFactor);
    },

    /**
     * @method
     * Transforms a canvas coordinate to document coordinate.
     *
     * @param {Number} x the x coordinate in the canvas
     * @param {Number} y the y coordinate in the canvas
     *
     * @returns {draw2d.geo.Point} the coordinate in relation to the document [0,0] position
     */
    fromCanvasToDocumentCoordinate: function(x,y)
    {
        return new draw2d.geo.Point(
            ((x*(1/this.zoomFactor)) + this.getAbsoluteX()),
            ((y*(1/this.zoomFactor)) + this.getAbsoluteY()));
    }
});

;
/*jshint sub:true*/
/*jshint evil:true */


/**
 * 
 * The **GraphicalEditor** is responsible for layout and dialog handling.
 * 
 * @author Andreas Herz
 */


var Widget = draw2d.Canvas.extend({

    init:function()
    {
        var _this = this;
        var id = "draw2dCanvas";
        this._super(id, 6000,6000);
        this.simulate = false;
        this.animationFrameFunc = $.proxy(this._calculate,this);

        // nice grid decoration for the canvas paint area
        //
        this.grid =  new draw2d.policy.canvas.ShowGridEditPolicy(20);
        this.installEditPolicy( this.grid);

        var circuit = this.getParam("circuit");
       $.getJSON(circuit, function (json) {
            var reader = new Reader();
            reader.unmarshal(widget, json);

            _this.shiftDocument();
            _this.simulationStart();
        });

    },

    simulationStart:function()
    {
        this.simulate=true;

        this.installEditPolicy(new SimulationEditPolicy());
        this.commonPorts.each(function(i,p){
            p.setVisible(false);
        });
        requestAnimationFrame(this.animationFrameFunc);
    },

    _calculate:function()
    {
        // call the "calculate" method if given to calculate the output-port values
        //
        this.getFigures().each(function(i,figure){
            figure.calculate();
        });

        // transport the value from outputPort to inputPort
        //
        this.getLines().each(function(i,line){
            var outPort = line.getSource();
            var inPort  = line.getTarget();
            inPort.setValue(outPort.getValue());
            line.setColor(outPort.getValue()?"#C21B7A":"#0078F2");
        });

        if(this.simulate===true){
            requestAnimationFrame(this.animationFrameFunc);
        }
    },


    getParam: function( name )
    {
        name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
        var regexS = "[\\?&]"+name+"=([^&#]*)";
        var regex = new RegExp( regexS );
        var results = regex.exec( window.location.href );

        // the param isn'T part of the normal URL pattern...
        //
        if( results === null ) {
            // maybe it is part in the hash.
            //
            regexS = "[\\#]"+name+"=([^&#]*)";
            regex = new RegExp( regexS );
            results = regex.exec( window.location.hash );
            if( results === null ) {
                return null;
            }
        }

        return results[1];
    },

    getBoundingBox: function(){
        var xCoords = [];
        var yCoords = [];
        this.getFigures().each(function(i,f){
            var b = f.getBoundingBox();
            xCoords.push(b.x, b.x+b.w);
            yCoords.push(b.y, b.y+b.h);
        });
        var minX   = Math.min.apply(Math, xCoords);
        var minY   = Math.min.apply(Math, yCoords);
        var width  = Math.max(10,Math.max.apply(Math, xCoords)-minX);
        var height = Math.max(10,Math.max.apply(Math, yCoords)-minY);

        return new draw2d.geo.Rectangle(minX,minY,width,height);
    },

    shiftDocument:function()
    {
        // get the bounding box of the document and translate the complete document
        // into the center of the canvas. Scroll to the top left corner after them
        //
        var bb = this.getBoundingBox();

        var dx = -bb.x;
        var dy = -bb.y;

        this.getFigures().each(function(i,f){
            f.translate(dx,dy);
        });
        this.getLines().each(function(i,f){
            f.translate(dx,dy);
        });
    }


});

;
var About = Class.extend(
{

    init:function(){
     },

	show:function(){
		
	    this.splash = $(
	            '<div id="splash">'+
	            '<div>Draw2D Designer<br>'+
	            '@VERSION@'+
	            '</div>'+
	            '</div>');
	    this.splash.hide();
	    $("body").append(this.splash);
	    
	    this.splash.fadeIn("fast");
	},
	
	hide: function()
	{
        this.splash.delay(2500)
        .fadeOut( "slow", $.proxy(function() {
            this.splash.remove();
        },this));
	}

      
});  
;
var CodeDialog = Class.extend(
    {

        init:function(){
        },

        show:function(js){
            $('#codePreviewDialog .prettyprint').text(js);
            $('#codePreviewDialog .prettyprint').removeClass("prettyprinted");
            prettyPrint();
            $('#codePreviewDialog').modal('show');
        }
});
;
var FigureConfigDialog = (function () {

    //"private" variables
    var currentFigure =null;

    //"public" stuff
    return {
        show: function(figure, pos)
        {
            currentFigure=figure;

            var settings = figure.getParameterSettings().slice(0);
            $.each(settings,function(i,el){
                el.value = currentFigure.attr("userData."+el.name);
            });
            var compiled = Handlebars.compile(
                '  <div class="header">Object Configuration</div>   '+
                '  {{#each settings}}               '+
                '      {{#ifCond property.type "===" "blocid"}}      '+
                '         <div class="form-group">'+
                '           <label for="figure_property_{{name}}">{{label}}</label>'+
                '           <select class="form-control" id="figure_property_{{name}}" data-name="{{name}}" size="4"> '+
                '               <option value="-unconnected-">no device selected</option>   '+
                '               {{#each ../blocs_push}}               '+
                '               <option data-name="{{name}}" value="{{blocId}}">Push {{blocNr}}</option>   '+
                '               {{/each}}               '+
                '           </select>   '+
                '         </div>                  '+
                      '{{else}}                   '+
                '         <div class="form-group">'+
                '           <label for="figure_property_{{name}}">{{label}}</label>'+
                '           <input type="text" class="form-control" id="figure_property_{{name}}" data-name="{{name}}" value="{{value}}" placeholder="{{label}}">'+
                '         </div>                  '+
                    '{{/ifCond}}                  '+
                '  {{/each}}                  '+
                '<button class="submit">Ok</button> '
            );
            var output = compiled({
                settings: settings,
                blocs_push : hardware.bloc.connected().filter(function(val){return val.blocType==="Push";})
            });

            $("#figureConfigDialog").html(output);
            $("#figureConfigDialog").show().css({top: pos.y, left: pos.x, position:'absolute'});
            $("#figureConfigDialog input, #figureConfigDialog select").focus();

            $("#figureConfigDialog input").keypress(function(e) {
                if(e.which == 13) {
                    FigureConfigDialog.hide();
                }
            });
            $("#figureConfigDialog .submit").on("click",function(){FigureConfigDialog.hide();});

            $.each(settings,function(index, setting){
                var figureValue = currentFigure.attr("userData." + setting.name);
                $('#figureConfigDialog select[data-name="'+setting.name+'"] option[value="'+figureValue+'"]').attr('selected','selected');

            });
        },

        hide: function()
        {
            if(currentFigure!==null) {
                $("#figureConfigDialog input, #figureConfigDialog select").each(function (i, element) {
                    element = $(element);
                    var value = element.val();
                    var name = element.data("name");

                    currentFigure.attr("userData." + name, value);
                });
            }
            $("#figureConfigDialog").hide();
            $("#figureConfigDialog").html("");

            currentFigure=null;
        }
    };
})();

;
var FileNew = Class.extend({

    /**
     * @constructor
     *
     */
    init:function(app){
        this.app = app;
    },

    /**
     * @method
     *
     * Open the file picker and load the selected file.<br>
     *
     * @param {Function} successCallback callback method if the user select a file and the content is loaded
     * @param {Function} errorCallback method to call if any error happens
     *
     * @since 4.0.0
     */
    show: function()
    {
        var _this = this;
        $("#githubNewFileDialog .githubFileName").val("NewDocument");
        $('#githubNewFileDialog').on('shown.bs.modal', function () {
            $(this).find('input:first').focus();
        });
        $("#githubNewFileDialog").modal("show");

        $("#githubNewFileDialog .okButton").on("click", function () {
             var name = $("#githubNewFileDialog .githubFileName").val();
            $('#githubNewFileDialog').modal('hide');
            _this.app.fileNew();
            _this.app.currentFileHandle.title = name;
        });
    }
});
;
FileOpen = Class.extend({

    /**
     * @constructor
     *
     */
    init:function(fileHandle)
    {
        this.currentFileHandle=fileHandle;
    },

    /**
     * @method
     *
     * Open the file picker and load the selected file.<br>
     *
     * @param {Function} successCallback callback method if the user select a file and the content is loaded
     * @param {Function} errorCallback method to call if any error happens
     *
     * @since 4.0.0
     */
    show: function(successCallback)
    {
        $('#githubFileSelectDialog').modal('show');

        this.fetchPathContent( successCallback);
    },

    fetchPathContent: function( successCallback )
    {
        var _this = this;

        $.ajax({
                url:conf.backend.file.list ,
                xhrFields: {
                    withCredentials: true
                },
                success:function(response) {
                    var files = response.files;
                    // sort the reusult
                    // Directories are always on top
                    //
                    files.sort(function (a, b) {
                        if (a.type === b.type) {
                            if (a.name.toLowerCase() < b.name.toLowerCase())
                                return -1;
                            if (a.name.toLowerCase() > b.name.toLowerCase())
                                return 1;
                            return 0;
                        }
                        if (a.type === "dir") {
                            return -1;
                        }
                        return 1;
                    });

                    var compiled = Hogan.compile(
                        '         {{#files}}' +
                        '           <a href="#" data-draw2d="{{draw2d}}" class="list-group-item githubPath text-nowrap" data-name="{{name}}" data-id="{{id}}">' +
                        '              <span class="fa fa-file-o"></span>' +
                        '              {{{name}}}' +
                        '           </a>' +
                        '         {{/files}}'
                    );
                    var output = compiled.render({
                        files: files,
                        draw2d: function () {
                            return this.id.endsWith(conf.fileSuffix);
                        }
                    });

                    $("#githubFileSelectDialog .githubNavigation").html($(output));
                    $("#githubFileSelectDialog .githubNavigation").scrollTop(0);


                    $('.githubPath[data-draw2d="true"]').on("click", function () {
                        var id   = $(this).data("id");
                        $('#githubFileSelectDialog').modal('hide');
                        successCallback(id);
                    });
                }
        });
    }
});
;
var FileSave = Class.extend({

    /**
     * @constructor
     *
     */
    init:function(fileHandler){
        this.currentFileHandle = fileHandler;
    },

    /**
     * @method
     *
     * Open the file picker and load the selected file.<br>
     *
     * @param {Function} successCallback callback method if the user select a file and the content is loaded
     * @param {Function} errorCallback method to call if any error happens
     *
     * @since 4.0.0
     */
    show: function(canvas, successCallback)
    {
        var _this = this;

        $("#githubSaveFileDialog .githubFileName").val(_this.currentFileHandle.title);

        $('#githubSaveFileDialog').on('shown.bs.modal', function () {
            $(this).find('input:first').focus();
        });
        $("#githubSaveFileDialog").modal("show");

        // Button: Commit to GitHub
        //
        $("#githubSaveFileDialog .okButton").on("click", function () {

            canvas.setCurrentSelection(null);
            new draw2d.io.png.Writer().marshal(canvas, function (imageDataUrl){
                var writer = new draw2d.io.json.Writer();
                writer.marshal(canvas, function (json, base64) {
                    var name = $("#githubSaveFileDialog .githubFileName").val();
                    $.ajax({
                            url: conf.backend.file.save,
                            method: "POST",
                            xhrFields: {
                                withCredentials: true
                            },
                            data:{
                                id:name,
                                content:JSON.stringify({draw2d:json, image:imageDataUrl}, undefined, 2)
                            }
                        }
                    ).done(function(){
                        _this.currentFileHandle.title=name;
                        $('#githubSaveFileDialog').modal('hide');
                        successCallback();
                    });

                });
            }, canvas.getBoundingBox().scale(10, 10));
        });

    }

});
;
var MarkdownDialog = Class.extend(
    {

        init:function()
        {
            this.defaults = {
                html:         false,        // Enable HTML tags in source
                xhtmlOut:     false,        // Use '/' to close single tags (<br />)
                breaks:       false,        // Convert '\n' in paragraphs into <br>
                langPrefix:   'language-',  // CSS language prefix for fenced blocks
                linkify:      true,         // autoconvert URL-like texts to links
                linkTarget:   '',           // set target to open link in
                typographer:  true          // Enable smartypants and other sweet transforms
            };
        },

        show:function(markdown)
        {
            var markdownParser = new Remarkable('full', this.defaults);
            $('#markdownDialog .html').html(markdownParser.render(markdown));
            $('#markdownDialog').modal('show');
        }
});
;
/*!

 <!-- Complete usage -->
 <button class=" popconfirm_full" data-toggle='confirmation' id="important_action">Full featured</button>


 // (example jquery click event)
 $('#important_action').on("click",function() {
     alert('You clicked, and valided this button !');
 });

 // Full featured example
 $("[data-toggle='confirmation']").popConfirm({
     title: "Delete File?",
     content: "",
     placement: "bottom" // (top, right, bottom, left)
 });


 */

(function ($) {
    'use strict';
    /*global jQuery, $*/
    /*jslint nomen: true, evil: true*/
    $.fn.extend({
        popConfirm: function (options) {
            var defaults = {
                    title: 'Confirmation',
                    content: 'Are you really sure ?',
                    placement: 'right',
                    container: 'body',
                    yesBtn: 'Yes',
                    noBtn: 'No'
                },
                last = null;
            options = $.extend(defaults, options);
            return this.each(function () {
                var self = $(this),
                    arrayActions = [],
                    arrayDelegatedActions = [],
                    eventToConfirm,
                    optName,
                    optValue,
                    i,
                    elmType,
                    code,
                    form;

                // Load data-* attriutes
                for (optName in options) {
                    if (options.hasOwnProperty(optName)) {
                        optValue = $(this).attr('data-confirm-' + optName);
                        if (optValue) {
                            options[optName] = optValue;
                        }
                    }
                }

                // If there are jquery click events
                if (jQuery._data(this, "events") && jQuery._data(this, "events").click) {

                    // Save all click handlers
                    for (i = 0; i < jQuery._data(this, "events").click.length; i = i + 1) {
                        arrayActions.push(jQuery._data(this, "events").click[i].handler);
                    }

                    // unbind it to prevent it firing
                    $(self).unbind("click");
                }

                // If there are jquery delegated click events
                if (self.data('remote') && jQuery._data(document, "events") && jQuery._data(document, "events").click) {

                    // Save all delegated click handlers that apply
                    for (i = 0; i < jQuery._data(document, "events").click.length; i = i + 1) {
                        elmType = self[0].tagName.toLowerCase();
                        if (jQuery._data(document, "events").click[i].selector && jQuery._data(document, "events").click[i].selector.indexOf(elmType + "[data-remote]") !== -1) {
                            arrayDelegatedActions.push(jQuery._data(document, "events").click[i].handler);
                        }
                    }
                }

                // If there are hard onclick attribute
                if (self.attr('onclick')) {
                    // Extracting the onclick code to evaluate and bring it into a closure
                    code = self.attr('onclick');
                    arrayActions.push(function () {
                        eval(code);
                    });
                    $(self).prop("onclick", null);
                }

                // If there are href link defined
                if (!self.data('remote') && self.attr('href')) {
                    // Assume there is a href attribute to redirect to
                    arrayActions.push(function () {
                        window.location.href = self.attr('href');
                    });
                }

                // If the button is a submit one
                if (self.attr('type') && self.attr('type') === 'submit') {
                    // Get the form related to this button then store submiting in closure
                    form = $(this).parents('form:first');
                    arrayActions.push(function () {
                        // Add the button name / value if specified
                        if(typeof self.attr('name') !== "undefined") {
                            $('<input type="hidden">').attr('name', self.attr('name')).attr('value', self.attr('value')).appendTo(form);
                        }
                        form.submit();
                    });
                }

                self.popover({
                    trigger: 'manual',
                    title: options.title,
                    html: true,
                    placement: options.placement,
                    container: options.container,
                    //Avoid using multiline strings, no support in older browsers.
                    content: options.content + '<p class="button-group" style="margin-top: 10px; text-align: center;"><button type="button" class="btn btn-small confirm-dialog-btn-abort">' + options.noBtn + '</button> <button type="button" class="btn btn-small btn-danger confirm-dialog-btn-confirm">' + options.yesBtn + '</button></p>'
                }).click(function (e) {
                    if (last && last !== self) {
                        last.popover('hide').removeClass('popconfirm-active');
                    }
                    last = self;
                });

                $(document).on('click', function () {
                    if (last) {
                        last.popover('hide').removeClass('popconfirm-active');
                    }
                });

                self.bind('click', function (e) {
                    eventToConfirm = e;

                    e.preventDefault();
                    e.stopPropagation();

                    $('.popconfirm-active').not(self).popover('hide').removeClass('popconfirm-active');
                    self.popover('show').addClass('popconfirm-active');

                    $(document).find('.popover .confirm-dialog-btn-confirm').one('click', function (e) {
                        for (i = 0; i < arrayActions.length; i = i + 1) {
                            arrayActions[i].apply(self);
                        }

                        for (i = 0; i < arrayDelegatedActions.length; i = i + 1) {
                            arrayDelegatedActions[i].apply(self, [eventToConfirm.originalEvent]);
                        }

                        self.popover('hide').removeClass('popconfirm-active');
                    });
                    $(document).find('.popover .confirm-dialog-btn-abord').bind('click', function (e) {
                        self.popover('hide').removeClass('popconfirm-active');
                    });
                });
            });
        }
    });
}(jQuery));
;
/*jshint evil:true */

var Connection = draw2d.Connection.extend({

    NAME: "Connection",

    init : function(attr, setter, getter)
    {
        this._super(attr, setter, getter);
    },

    setCanvas: function(canvas)
    {
        this._super(canvas);

        // remove any decoration if exists
        if(canvas===null){

        }
    },

    getValue:function()
    {
        return this.getSource().getValue();
    },

    /**
     * Return the ProbeFigure if the connection has any or NULL
     *
     * @return {ProbeFigure}
     */
    getProbeFigure:function()
    {
        var entry= this.children.find(function(entry){
               return entry.figure instanceof ProbeFigure;
             });
        return (entry!==null)?entry.figure:null;
    },

    disconnect: function()
    {
       this._super();

       // remove some decorations of the router.
       // This is a design flaw. the router creates the decoration and the connection must remove them :-/
       // Unfortunately the Router didn't have a callback when a connection is removed from the canvas.
       //
        if(typeof this.vertexNodes!=="undefined" && this.vertexNodes!==null){
            this.vertexNodes.remove();
            delete this.vertexNodes;
        }
    },

    add: function(figure)
    {
        this._super.apply(this,arguments);

        if(figure instanceof ProbeFigure && this.canvas !==null){
            this.canvas.fireEvent("probe:add", {figure:figure});
        }
    },


    remove: function(figure)
    {
        this._super.apply(this,arguments);

        if(figure instanceof ProbeFigure && this.canvas !==null){
            this.canvas.fireEvent("probe:remove", {figure:figure});
        }
    },

    /**
     * @method
     * Return an objects with all important attributes for XML or JSON serialization
     *
     * @returns {Object}
     */
    getPersistentAttributes : function()
    {
        var memento = this._super();

        // add all decorations to the memento
        //
        memento.labels = [];
        this.children.each(function(i,e){
            var labelJSON = e.figure.getPersistentAttributes();
            labelJSON.locator=e.locator.NAME;
            memento.labels.push(labelJSON);
        });

        return memento;
    },

    /**
     * @method
     * Read all attributes from the serialized properties and transfer them into the shape.
     *
     * @param {Object} memento
     * @returns
     */
    setPersistentAttributes : function(memento)
    {
        // patch the router from some legacy data
        //
        memento.router ="ConnectionRouter";

        this._super(memento);

        // remove all decorations created in the constructor of this element
        //
        this.resetChildren();

        // and add all children of the JSON document.
        //
        if(memento.labels) {
            $.each(memento.labels, $.proxy(function (i, json) {
                // create the figure stored in the JSON
                var figure = eval("new " + json.type + "()");

                // apply all attributes
                figure.setPersistentAttributes(json);

                // instantiate the locator
                var locator = eval("new " + json.locator + "()");

                // add the new figure as child to this figure
                this.add(figure, locator);
            }, this));
        }
    }

});

;

var DecoratedInputPort = draw2d.InputPort.extend({

    NAME: "DecoratedInputPort",

    init : function(attr, setter, getter)
    {
        this.hasChanged = false;

        this._super(attr, setter, getter);
        
        this.decoration = new MarkerFigure();

        this.add(this.decoration, new draw2d.layout.locator.LeftLocator({margin:8}));

        this.on("disconnect",function(emitter, event){
            this.decoration.setVisible(this.getConnections().getSize()===0);

            // default value of a not connected port is always HIGH
            //
            if(this.getConnections().getSize()===0){
                this.setValue(true);
            }
        }.bind(this));

        this.on("connect",function(emitter, event){
            this.decoration.setVisible(false);
        }.bind(this));

        this.on("dragend",function(emitter, event){
            this.decoration.setVisible(this.getConnections().getSize()===0);
        }.bind(this));
        
        this.on("drag",function(emitter, event){
            this.decoration.setVisible(false);
        }.bind(this));

        // a port can have a value. Usefull for workflow engines or circuit diagrams
        this.setValue(true);
    },

    useDefaultValue:function()
    {
        this.decoration.setStick(true);
    },

    setValue:function(value)
    {
        this.hasChanged = this.value !==value;
        this._super(value);
    },

    hasChangedValue: function()
    {
        return this.hasChanged;
    },

    hasRisingEdge: function()
    {
        return this.hasChangedValue()&& this.getValue();
    },

    hasFallingEdge: function()
    {
        return this.hasChangedValue() && !this.getValue();
    }
});

;
/**
 * The markerFigure is the left hand side annotation for a DecoratedPort.
 *
 * It contains two children
 *
 * StateAFigure: if the mouse hover and the figure isn't permanent visible
 * StateBFigure: either the mouse is over or the user pressed the checkbox to stick the figure on the port
 *
 * This kind of decoration is usefull for defualt values on workflwos enginges or circuit diagrams
 *
 */
var MarkerFigure = draw2d.shape.layout.VerticalLayout.extend({

    NAME : "MarkerFigure",

    init : function(attr, setter, getter)
    {
        var _this = this;

        this.isMouseOver = false;        // indicator if the mouse is over the element
        this.stick       = false;        // indicator if the stateBFigure should always be visible
        this.defaultValue= true;         // current selected default value for the decoration

        this._super($.extend({
              stroke:0
        },attr),
        setter, 
        getter);


        // figure if the decoration is not permanent visible (sticky note)
        this.add(this.stateA = new MarkerStateAFigure({text:"X"}));
        // figure if the decoration permanent visible
        this.add(this.stateB = new MarkerStateBFigure({text:"X"}));


        this.on("mouseenter",function(emitter, event){
            _this.onMouseOver(true);
        });

        this.on("mouseleave",function(emitter, event){
            _this.onMouseOver(false);
        });

        this.on("click",function(emitter, event){
            if (_this.isVisible() === false) {
                return;//silently
            }

            if(_this.stateB.getStickTickFigure().getBoundingBox().hitTest(event.x, event.y) === true){
                _this.setStick(!_this.getStick());
            }
            else if(_this.stateB.getLabelFigure().getBoundingBox().hitTest(event.x, event.y) === true){
                $.contextMenu({
                    selector: 'body',
                    trigger:"left",
                    events:
                    {
                        hide:function(){ $.contextMenu( 'destroy' ); }
                    },
                    callback: $.proxy(function(key, options)
                    {
                        // propagate the default value to the port
                        //
                        switch(key){
                            case "high":
                                _this.setDefaultValue(true);
                                _this.setStick(true);
                                break;
                            case "low":
                                _this.setDefaultValue(false);
                                _this.setStick(true);
                                break;
                            default:
                                break;
                        }

                    },this),
                    x:event.x,
                    y:event.y,
                    items:{
                        "high": {name: "High"},
                        "low":  {name: "Low" }
                    }
                });

            }
        });

        this.setDefaultValue(true);
        this.onMouseOver(false);
    },

    onMouseOver: function(flag)
    {
        this.isMouseOver = flag;

        if(this.visible===false){
            return; // silently
        }

        if(this.stick===true) {
            this.stateA.setVisible(false);
            this.stateB.setVisible(true);
        }
        else{
            this.stateA.setVisible(!this.isMouseOver);
            this.stateB.setVisible( this.isMouseOver);
        }

        return this;
    },


    setVisible: function(flag)
    {
        this._super(flag);

        // update the hover/stick state of the figure
        this.onMouseOver(this.isMouseOver);

        return this;
    },


    setStick:function(flag)
    {
        this.stick = flag;
        this.onMouseOver(this.isMouseOver);


        // the port has only a default value if the decoration is visible
        this.parent.setValue(flag?this.defaultValue:null);

        this.stateB.setTick(this.getStick());

        return this;
    },


    getStick:function()
    {
        return this.stick;
    },


    setText: function(text)
    {
        this.stateB.setText(text);

        return this;
    },

    setDefaultValue: function(value)
    {
        this.defaultValue = value;

        this.setText((this.defaultValue===true)?"High":"Low ");
        this.stateB.setTintColor((this.defaultValue===true)?conf.color.high:conf.color.low);

        // only propagate the value to the parent if the decoration permanent visible
        //
        if(this.stick===true){
            this.parent.setValue(this.defaultValue);
        }
    }
});

;
/**
 * This is only the mouseover reactive shape. A little bit smaller than the visible shape
 *
 * Or you can display this shape with opacity of 0.2 to indicate that this is a reactive area.
 */
var MarkerStateAFigure = draw2d.shape.basic.Label.extend({

    NAME : "MarkerStateAFigure",

    /**
     * @param attr
     */
    init : function(attr, setter, getter)
    {
        this._super($.extend({
            padding:{left:5, top:2, bottom:2, right:10},
            bgColor:null,
            stroke:1,
            color:null,
            fontColor:null,
            fontSize:8
        },attr), 
        setter, 
        getter);

        // we must override the hitTest method to ensure that the parent can receive the mouseenter/mouseleave events.
        // Unfortunately draw2D didn't provide event bubbling like HTML. The first shape in queue consumes the event.
        //
        // now this shape is "dead" for any mouse events and the parent must/can handle this.
        this.hitTest = function(){return false;};
    }

});
;
var MarkerStateBFigure = draw2d.shape.layout.HorizontalLayout.extend({

    NAME : "MarkerStateBFigure",

    /**
     * @param attr
     */
    init : function(attr, setter, getter)
    {
        this.tintColor = conf.color.low;

        this._super($.extend({
            bgColor:"#FFFFFF",
            stroke:1,
            color:conf.color.low,
            radius:2,
            padding:{left:3, top:2, bottom:0, right:8},
            gap:5
        },attr), 
        setter, 
        getter);

        this.stickTick = new draw2d.shape.basic.Circle({
            diameter:8,
            bgColor:"#f0f0f0",
            stroke:1,
            resizeable:false
        });
        this.add(this.stickTick);
        this.stickTick.hitTest = function(){return false;};
        this.stickTick.addCssClass("highlightOnHover");

        this.label = new draw2d.shape.basic.Label({
            text:attr.text,
            resizeable:false,
            stroke:0,
            padding:0,
            fontSize:8,
            fontColor:"#303030"
        });
        this.add(this.label);
        this.label.hitTest = function(){return false;};
        this.label.addCssClass("highlightOnHover");

        // we must override the hitTest method to ensure that the parent can receive the mouseenter/mouseleave events.
        // Unfortunately draw2D didn't provide event bubbling like HTML. The first shape in queue consumes the event.
        //
        // now this shape is "dead" for any mouse events and the parent must/can handle this.
        this.hitTest = function(){return false;};
    },

    setText: function(text)
    {
        this.label.setText(text);
    },

    setTintColor: function(color)
    {
        this.tintColor = color;
        this.attr({color:color});
        this.label.attr({fontColor:color});
    },

    setTick :function(flag)
    {
        this.stickTick.attr({bgColor:flag?this.tintColor:"#f0f0f0"});
    },

    getStickTickFigure:function()
    {
        return this.stickTick;
    },

    getLabelFigure:function()
    {
        return this.label;
    },

    /**
     * @method
     *
     *
     * @template
     **/
    repaint: function(attributes)
    {
        if(this.repaintBlocked===true || this.shape===null){
            return;
        }

        attributes= attributes || {};

        attributes.path = this.calculatePath();

        this._super(attributes);
    },


    /**
     * @method
     *
     * Override the default rendering of the HorizontalLayout, which is a simple
     * rectangle. We want an arrow.
     */
    createShapeElement : function()
    {
        return this.canvas.paper.path(this.calculatePath());
    },

    /**
     * stupid copy&paste the code from the Polygon shape...unfortunately the LayoutFigure isn't a polygon.
     *
     * @returns {string}
     */
    calculatePath: function()
    {
        var arrowLength=8;

        this.vertices   = new draw2d.util.ArrayList();

        var w  = this.width;
        var h  = this.height;
        var pos= this.getAbsolutePosition();
        var i  = 0;
        var length=0;
        this.vertices.add(new draw2d.geo.Point(pos.x,  pos.y)  );
        this.vertices.add(new draw2d.geo.Point(pos.x+w-arrowLength,pos.y)  );

        this.vertices.add(new draw2d.geo.Point(pos.x+w,pos.y+h/2));

        this.vertices.add(new draw2d.geo.Point(pos.x+w-arrowLength,pos.y+h));
        this.vertices.add(new draw2d.geo.Point(pos.x  ,pos.y+h));

        var radius = this.getRadius();
        var path = [];
        // hard corners
        //
        if(radius === 0){
            length = this.vertices.getSize();
            var p = this.vertices.get(0);
            path.push("M",p.x," ",p.y);
            for(i=1;i<length;i++){
                p = this.vertices.get(i);
                path.push("L", p.x, " ", p.y);
            }
            path.push("Z");
        }
        // soften/round corners
        //
        else{
            length = this.vertices.getSize();
            var start = this.vertices.first();
            var end   = this.vertices.last();
            if(start.equals(end)){
                length = length-1;
                end = this.vertices.get(length-1);
            }
            var begin   = draw2d.geo.Util.insetPoint(start,end, radius);
            path.push("M", begin.x, ",", begin.y);
            for( i=0 ;i<length;i++){
                start = this.vertices.get(i);
                end   = this.vertices.get((i+1)%length);
                modStart = draw2d.geo.Util.insetPoint(start,end, radius);
                modEnd   = draw2d.geo.Util.insetPoint(end,start,radius);
                path.push("Q",start.x,",",start.y," ", modStart.x, ", ", modStart.y);
                path.push("L", modEnd.x, ",", modEnd.y);
            }
        }
        return path.join("");
    }


});

;
var ProbeFigure = draw2d.shape.basic.Label.extend({

    NAME : "ProbeFigure",

    /**
     * @param attr
     */
    init : function(attr, setter, getter)
    {
        this._super($.extend({
                padding:{left:5, top:2, bottom:2, right:10},
                bgColor:"#FFFFFF",
                stroke:0,
                color:"#000000",
                fontSize:8
            },attr),
            setter,
            getter);

        // the sort index in the probe window
        //
        this.index = 0;
    },


    getValue:function()
    {
        return this.getParent().getValue();
    },

    getIndex: function()
    {
        return this.index;
    },

    setIndex: function( index)
    {
        this.index = index;

        return this;
    },


    /**
     * @method
     * Return an objects with all important attributes for XML or JSON serialization
     *
     * @returns {Object}
     */
    getPersistentAttributes : function()
    {
        var memento = this._super();

        memento.index = this.index;

        return memento;
    },

    /**
     * @method
     * Read all attributes from the serialized properties and transfer them into the shape.
     *
     * @param {Object} memento
     * @returns
     */
    setPersistentAttributes : function(memento)
    {
        this._super(memento);

        if(typeof memento.index !=="undefined"){
            this.index = parseInt(memento.index);
        }
    }

});

;
/*jshint evil:true */


/**
 * The markerFigure is the left hand side annotation for a DecoratedPort.
 *
 * It contains two children
 *
 * StateAFigure: if the mouse hover and the figure isn't permanent visible
 * StateBFigure: either the mouse is over or the user pressed the checkbox to stick the figure on the port
 *
 * This kind of decoration is usefull for defualt values on workflwos enginges or circuit diagrams
 *
 */
var Raft = draw2d.shape.composite.Raft.extend({

    NAME : "Raft",

    init : function(attr, setter, getter)
    {
        this._super(attr, setter, getter);
    },

    calculate: function()
    {

    },

    onStart:function()
    {

    },

    onStop:function()
    {

    },

    toBack:function(figure)
    {
        if(this.canvas.getFigures().getSize()===1){
            return ; // silently
        }

        // unfortunately the shape goes behind the "canvas decoration" which could be the grid or dots.
        // this is sad and unwanted. In this case we select the first figure in th canvas and set the Raft behind of them
        // instead of "behind of ALL shapes"
        var first = this.canvas.getFigures().first();
        this._super(first);
    },

    getParameterSettings: function()
    {
        return [];
    },

    /**
     * @method
     * Return an objects with all important attributes for XML or JSON serialization
     *
     * @returns {Object}
     */
    getPersistentAttributes : function()
    {
        var memento = this._super();

        // add all decorations to the memento
        //
        memento.labels = [];
        this.children.each(function(i,e){
            var labelJSON = e.figure.getPersistentAttributes();
            labelJSON.locator=e.locator.NAME;
            memento.labels.push(labelJSON);
        });

        return memento;
    },

    /**
     * @method
     * Read all attributes from the serialized properties and transfer them into the shape.
     *
     * @param {Object} memento
     * @returns
     */
    setPersistentAttributes : function(memento)
    {
        this._super(memento);

        // remove all decorations created in the constructor of this element
        //
        this.resetChildren();

        // and add all children of the JSON document.
        //
        $.each(memento.labels, $.proxy(function(i,json){
            // create the figure stored in the JSON
            var figure =  eval("new "+json.type+"()");

            // apply all attributes
            figure.attr(json);

            // instantiate the locator
            var locator =  eval("new "+json.locator+"()");

            // add the new figure as child to this figure
            this.add(figure, locator);
        },this));
    }

});

;
/**
 * Registry of all available devices (connected via RF24 adapter) and of the hub GPIO pins.
 * The hub could be an RaspberryPi or and Arduino.
 *
 * The "hub" is the receiver for the connected devices and expose its own
 * GPIO pins as well.
 *
 */
var hardware=(function(){
    var eventSubscriptions = {}; // event listener to the registry

    var values= {};
    var blocs = [];
    var socket= null;
    var fireEvent = function(event, args)
    {
        if (typeof eventSubscriptions[event] === 'undefined') {
            return;
        }

        var subscribers = eventSubscriptions[event];
        for (var i=0; i<subscribers.length; i++) {
            try{
                subscribers[i]( args);
            }
            catch(exc){
                console.log(exc);
                console.log(subscribers[i]);
            }
        }
    };

    return {
        /**
         * Init the listener for the socket.io events
         * Events could be
         *  - changes on the GPIO pins
         *  - new registered devices (blocs)
         *  - unregister of devices (blocs)
         *  - provides events of devices (blocs)
         *
         * @param s
         */
        init: function (s) {
            socket = s;
            socket.on("gpo:change", function (msg) {
                values[msg.pin] = !!parseInt(msg.value);
            });
            socket.on("bloc:value", function (msg) {
               values[msg.blocId] = !!parseInt(msg.value);
            });
            socket.on("bloc:register", function (msg) {
                blocs= blocs.filter(function(bloc) {
                    return bloc.blocId != msg.blocId;
                });
                blocs.push(msg);
                fireEvent("bloc:register",msg );
            });
            socket.on("bloc:unregister", function (msg) {
                blocs= blocs.filter(function(bloc) {
                    return bloc.blocId != msg.blocId;
                });
                fireEvent("bloc:unregister",msg );
            });

            // load all registered devices from the node.js server if any connected
            //
            socket.on('connect',function() {
                if (conf.backend.bloc.list !== null) {
                    $.ajax({url: conf.backend.bloc.list,method: "GET"})
                        .done(function (content) {
                            blocs = content;
                        });
                }
            });
        },
        gpio: {
            set: function (pin, value) {
                socket.emit('gpi:set', {
                    pin: pin,
                    value: value
                });
            },
            get: function (pin) {
                return values[pin];
            }
        },
        bloc: {
            set: function (blocId, value) {
                socket.emit('bloc:set', {
                    blocId: blocId,
                    value: value
                });
            },
            get: function (blocId) {
                return values[blocId];
            },
            connected: function () {
                return blocs;
            },

            isConnected: function(blocId){
                return $.grep(blocs, function(e){ return e.blocId == blocId; }).length>0;
            },

            /**
             * @method
             * Attach an event handler function to "bloc" based events
             *
             * possible events are:<br>
             * <ul>
             *   <li>bloc:register</li>
             *   <li>bloc:unregister</li>
             * </ul>
             *
             * @param {String}   event One or more space-separated event types
             * @param {Function} callback A function to execute when the event is triggered.
             *
             * @since 5.0.0
             */
            on: function(event, callback)
            {
                var events = event.split(" ");
                for(var i=0; i<events.length; i++){
                    if (typeof eventSubscriptions[events[i]] === 'undefined') {
                        eventSubscriptions[events[i]] = [];
                    }
                    eventSubscriptions[events[i]].push(callback);
                }
                return this;
            },

            /**
             * @method
             * The .off() method removes event handlers that were attached with {@link #on}.<br>
             * Calling .off() with no arguments removes all handlers attached to the registry.<br>
             *
             * @param {String|Function} eventOrFunction the event name of the registered function
             * @since 5.0.0
             */
            off: function( eventOrFunction)
            {
                if(typeof eventOrFunction ==="undefined"){
                    eventSubscriptions = {};
                }
                else if( typeof eventOrFunction === 'string'){
                    eventSubscriptions[eventOrFunction] = [];
                }
                else{
                    var check = function( callback ) { return callback !== eventOrFunction; };
                    for(var event in this.eventSubscriptions ){
                        eventSubscriptions[event] =$.grep(eventSubscriptions[event], check);
                    }
                }

                return this;
            }
        }
    };
})();

// deprecated
var raspi = hardware;


;


var Reader = draw2d.io.json.Reader.extend({

    init:function(){
        this._super();
    },

    unmarshal:function(view, fileData)
    {
        // new JSON format with draw2&image content
        if(fileData.draw2d){
            this._super(view, fileData.draw2d);
        }
        // native JSON format
        else{
            this._super(view, fileData);
        }
    },

    createFigureFromType:function(type)
    {
        // path object types from older versions of JSON
        if(type === "draw2d.Connection"){
            type = "Connection";
        }

        return this._super(type);
    }
});

;
// Handlebars isn't loaded if "brain" circuit is running within an widget
//
if(typeof Handlebars !=="undefined") {
    Handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
        switch (operator) {
            case '==':
                return (v1 == v2) ? options.fn(this) : options.inverse(this);
            case '===':
                return (v1 === v2) ? options.fn(this) : options.inverse(this);
            case '!==':
                return (v1 !== v2) ? options.fn(this) : options.inverse(this);
            case '<':
                return (v1 < v2) ? options.fn(this) : options.inverse(this);
            case '<=':
                return (v1 <= v2) ? options.fn(this) : options.inverse(this);
            case '>':
                return (v1 > v2) ? options.fn(this) : options.inverse(this);
            case '>=':
                return (v1 >= v2) ? options.fn(this) : options.inverse(this);
            case '&&':
                return (v1 && v2) ? options.fn(this) : options.inverse(this);
            case '||':
                return (v1 || v2) ? options.fn(this) : options.inverse(this);
            default:
                return options.inverse(this);
        }
    });
}


/*
 * object.watch polyfill
 *
 * 2012-04-03
 *
 * By Eli Grey, http://eligrey.com
 * Public Domain.
 * NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.
 */
// object.watch
if (!Object.prototype.watch) {
    Object.defineProperty(Object.prototype, "watch", {
        enumerable: false ,
        configurable: true,
        writable: false,
        value: function (prop, handler) {
            var
                oldval = this[prop],
                newval = oldval,
                getter = function () {
                    return newval;
                },
                setter = function (val) {
                    oldval = newval;
                    newval = handler.call(this, prop, oldval, val);
                    return newval;
                };

            if (delete this[prop]) { // can't watch constants
                Object.defineProperty(this, prop, {
                    get: getter,
                    set: setter,
                    enumerable: true,
                    configurable: true
                });
            }
        }
    });
}

// object.unwatch
if (!Object.prototype.unwatch) {
    Object.defineProperty(Object.prototype, "unwatch", {
        enumerable: false,
        configurable: true,
        writable: false,
        value: function (prop) {
            var val = this[prop];
            delete this[prop]; // remove accessors
            this[prop] = val;
        }
    });
}