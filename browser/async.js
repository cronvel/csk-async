(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.async = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*
	Async Kit
	
	Copyright (c) 2014 - 2016 Cédric Ronvel
	
	The MIT License (MIT)
	
	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:
	
	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;

/* global window */



if ( ! window.setImmediate )
{
	window.setImmediate = function( callback ) { return setTimeout( callback , 0 ) ; } ;
}

// Load async.js, export it, and set isBrowser to true
module.exports = require( './core.js' ) ;
module.exports.wrapper = require( './wrapper.js' ) ;
module.exports.isBrowser = true ;


},{"./core.js":2,"./wrapper.js":3}],2:[function(require,module,exports){
/*
	Async Kit
	
	Copyright (c) 2014 - 2016 Cédric Ronvel
	
	The MIT License (MIT)
	
	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:
	
	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/



// Async flow


/*
	TODO:
	- this: in all callback and event, it would be nice to bind the current execContext as 'this',
	  so for example each jobs can access to results of others...
	  -> DONE for callback but not for event
	- serialProgress() callback/event that is called for each element, but that respect sequence order 
	  even in parallel mode
	- config(): just set everything in one place?
	- dependenciesTree(): jobs are resolved using a dependencies' tree, that give arguments to transmit
	  from one Async function to another
	- async.Queue: job can be added after exec(), forever, until quit() is called (it needs some brainstorming here),
	  basicaly, some work should be done to move jobs from async.Plan to async.ExecContext
	- caolan/async's: compose(), detect(), filter() ?
	- Real async try/catch/finally, using node's Domain?
	- exportProxy() export a proxy function, if you call the function twice (or more) with the same arguments,
	  the subsequent call will process immediately, replaying all callback immediately and returning,
	  all with the same value
	
	TODO Promises:
	- promise() returning a Promise
	- Promise as a job item, or action function
	
	TODO Doc:
	- Jeu de piste/Organigramme en Markdown, de simples questions proposent des liens en réponse,
	  menant sur d'autres questions avec d'autres liens de réponses, etc... à la fin, on obtient
	  un code d'exemple qui sert de template à copier/coller.
*/

"use strict" ;



// Load modules dependencies
var NextGenEvents = require( 'nextgen-events' ) ;
var treeExtend = require( 'tree-kit/lib/extend.js' ) ;



var async = {} ;
module.exports = async ;





			//////////////////////////
			// Internal Async Error //
			//////////////////////////



// Extend Error
async.AsyncError = function AsyncError( message )
{
	Error.call( this ) ;
	Error.captureStackTrace && Error.captureStackTrace( this , this.constructor ) ;	// jshint ignore:line
	this.message = message ;
} ;

async.AsyncError.prototype = Object.create( Error.prototype ) ;
async.AsyncError.prototype.constructor = async.AsyncError ;



			//////////////////////////////////////////////////////
			// Async Plan factory: create different Plan object //
			//////////////////////////////////////////////////////



// Empty constructor, it is just there to support instanceof operator
async.Plan = function Plan()
{
	throw new Error( "[async] Cannot create an async Plan object directly" ) ;
} ;

//async.Plan.prototype = Object.create( NextGenEvents.prototype ) ;
async.Plan.prototype.constructor = async.Plan ;



// Common properties for all instance of async.Plan
var planCommonProperties = {
	// Configurable
	parallelLimit: { value: 1 , writable: true , enumerable: true , configurable: true } ,
	raceMode: { value: false , writable: true , enumerable: true , configurable: true } ,
	waterfallMode: { value: false , writable: true , enumerable: true , configurable: true } ,
	waterfallTransmitError: { value: false , writable: true , enumerable: true , configurable: true } ,
	whileAction: { value: undefined , writable: true , enumerable: true , configurable: true } ,
	whileActionBefore: { value: false , writable: true , enumerable: true , configurable: true } ,
	errorsAreFatal: { value: true , writable: true , enumerable: true , configurable: true } ,
	returnMapping1to1: { value: false , writable: true , enumerable: true , configurable: true } ,
	
	// Not configurable
	jobsData: { value: {} , writable: true , enumerable: true } ,
	jobsKeys: { value: [] , writable: true , enumerable: true } ,
	jobsUsing: { value: undefined , writable: true , enumerable: true } ,
	jobsTimeout: { value: undefined , writable: true , enumerable: true } ,
	returnLastJobOnly: { value: false , writable: true , enumerable: true } ,
	defaultAggregate: { value: undefined , writable: true , enumerable: true } ,
	returnAggregate: { value: false , writable: true , enumerable: true } ,
	transmitAggregate: { value: false , writable: true , enumerable: true } ,
	usingIsIterator: { value: false , writable: true , enumerable: true } ,
	thenAction: { value: undefined , writable: true , enumerable: true } ,
	catchAction: { value: undefined , writable: true , enumerable: true } ,
	finallyAction: { value: undefined , writable: true , enumerable: true } ,
	asyncEventNice: { value: -20 , writable: true , enumerable: true } ,
	maxRetry: { value: 0 , writable: true , enumerable: true } ,
	retryTimeout: { value: 0 , writable: true , enumerable: true } ,
	retryMultiply: { value: 1 , writable: true , enumerable: true } ,
	retryMaxTimeout: { value: Infinity , writable: true , enumerable: true } ,
	execMappingMinInputs: { value: 0 , writable: true , enumerable: true } ,
	execMappingMaxInputs: { value: 100 , writable: true , enumerable: true } ,
	execMappingCallbacks: { value: [ 'finally' ] , writable: true , enumerable: true } ,
	execMappingAggregateArg: { value: false , writable: true , enumerable: true } ,
	execMappingMinArgs: { value: 0 , writable: true , enumerable: true } ,
	execMappingMaxArgs: { value: 101 , writable: true , enumerable: true } ,
	execMappingSignature: { value: '( [finallyCallback] )' , writable: true , enumerable: true } ,
	locked: { value: false , writable: true , enumerable: true }
} ;



// Create an async.Plan flow, parallel limit is preset to 1 (series) as default, but customizable with .parallel()
async.do = function _do( jobsData )
{
	var asyncPlan = Object.create( async.Plan.prototype , planCommonProperties ) ;
	
	Object.defineProperties( asyncPlan , {
		execInit: { value: execDoInit.bind( asyncPlan ) } ,
		execNext: { value: execDoNext.bind( asyncPlan ) } ,
		execCallback: { value: execDoCallback } ,
		execLoopCallback: { value: execWhileCallback } ,
		execFinal: { value: execDoFinal.bind( asyncPlan ) }
	} ) ;
	
	asyncPlan.do( jobsData ) ;
	
	return asyncPlan ;
} ;



// Create an async parallel flow
async.parallel = function parallel( jobsData )
{
	var asyncPlan = Object.create( async.Plan.prototype , planCommonProperties ) ;
	
	Object.defineProperties( asyncPlan , {
		parallelLimit: { value: Infinity , writable: true , enumerable: true } ,
		execInit: { value: execDoInit.bind( asyncPlan ) } ,
		execNext: { value: execDoNext.bind( asyncPlan ) } ,
		execCallback: { value: execDoCallback } ,
		execLoopCallback: { value: execWhileCallback } ,
		execFinal: { value: execDoFinal.bind( asyncPlan ) }
	} ) ;
	
	asyncPlan.do( jobsData ) ;
	
	return asyncPlan ;
} ;



// Create an async series flow
async.series = function series( jobsData )
{
	var asyncPlan = Object.create( async.Plan.prototype , planCommonProperties ) ;
	
	Object.defineProperties( asyncPlan , {
		parallelLimit: { value: 1 , enumerable: true } ,
		execInit: { value: execDoInit.bind( asyncPlan ) } ,
		execNext: { value: execDoNext.bind( asyncPlan ) } ,
		execCallback: { value: execDoCallback } ,
		execLoopCallback: { value: execWhileCallback } ,
		execFinal: { value: execDoFinal.bind( asyncPlan ) }
	} ) ;
	
	asyncPlan.do( jobsData ) ;
	
	return asyncPlan ;
} ;



// Create an async parallel flow, and return the result of the first non-error
async.race = function race( jobsData )
{
	var asyncPlan = Object.create( async.Plan.prototype , planCommonProperties ) ;
	
	Object.defineProperties( asyncPlan , {
		raceMode: { value: true , enumerable: true } ,
		parallelLimit: { value: Infinity , writable: true , enumerable: true } ,
		errorsAreFatal: { value: false , writable: true , enumerable: true } ,
		execInit: { value: execDoInit.bind( asyncPlan ) } ,
		execNext: { value: execDoNext.bind( asyncPlan ) } ,
		execCallback: { value: execDoCallback } ,
		execLoopCallback: { value: execWhileCallback } ,
		execFinal: { value: execDoFinal.bind( asyncPlan ) }
	} ) ;
	
	// We only want the result of the first succeeding job
	asyncPlan.returnLastJobOnly = true ;
	
	asyncPlan.do( jobsData ) ;
	
	return asyncPlan ;
} ;



// Create an async series flow, each job transmit its results to the next jobs
async.waterfall = function waterfall( jobsData )
{
	var asyncPlan = Object.create( async.Plan.prototype , planCommonProperties ) ;
	
	Object.defineProperties( asyncPlan , {
		waterfallMode: { value: true , enumerable: true } ,
		waterfallTransmitError: { value: false , writable: true , enumerable: true } ,
		parallelLimit: { value: 1 , enumerable: true } ,
		execInit: { value: execDoInit.bind( asyncPlan ) } ,
		execNext: { value: execDoNext.bind( asyncPlan ) } ,
		execCallback: { value: execDoCallback } ,
		execLoopCallback: { value: execWhileCallback } ,
		execFinal: { value: execDoFinal.bind( asyncPlan ) }
	} ) ;
	
	// We only want the result of the first succeeding job
	asyncPlan.returnLastJobOnly = true ;
	
	asyncPlan.do( jobsData ) ;
	
	return asyncPlan ;
} ;



// Create an async foreach, parallel limit is preset to 1 (series) as default, but customizable with .parallel()
async.foreach = async.forEach = function foreach( jobsData , iterator )
{
	var asyncPlan = Object.create( async.Plan.prototype , planCommonProperties ) ;
	
	Object.defineProperties( asyncPlan , {
		usingIsIterator: { value: true , writable: true , enumerable: true } ,
		errorsAreFatal: { value: false , writable: true , enumerable: true } ,
		execInit: { value: execDoInit.bind( asyncPlan ) } ,
		execNext: { value: execDoNext.bind( asyncPlan ) } ,
		execCallback: { value: execDoCallback } ,
		execLoopCallback: { value: execWhileCallback } ,
		execFinal: { value: execDoFinal.bind( asyncPlan ) }
	} ) ;
	
	asyncPlan.do( jobsData ) ;
	asyncPlan.iterator( iterator ) ;
	
	return asyncPlan ;
} ;



// Create an async map, parallel limit is preset to Infinity, but customizable with .parallel()
async.map = function map( jobsData , iterator )
{
	var asyncPlan = Object.create( async.Plan.prototype , planCommonProperties ) ;
	
	Object.defineProperties( asyncPlan , {
		parallelLimit: { value: Infinity , writable: true , enumerable: true } ,
		usingIsIterator: { value: true , writable: true , enumerable: true } ,
		errorsAreFatal: { value: false , writable: true , enumerable: true } ,
		// the result mapping should match the jobs' data 1:1
		returnMapping1to1: { value: true , writable: false , enumerable: true } ,
		execInit: { value: execDoInit.bind( asyncPlan ) } ,
		execNext: { value: execDoNext.bind( asyncPlan ) } ,
		execCallback: { value: execDoCallback } ,
		execLoopCallback: { value: execWhileCallback } ,
		execFinal: { value: execDoFinal.bind( asyncPlan ) }
	} ) ;
	
	asyncPlan.do( jobsData ) ;
	asyncPlan.iterator( iterator ) ;
	
	return asyncPlan ;
} ;



// Create an async reduce, force parallel limit to 1 (does it make sense to do it in parallel?)
async.reduce = function reduce( jobsData , defaultAggregate , iterator )
{
	var asyncPlan = Object.create( async.Plan.prototype , planCommonProperties ) ;
	
	Object.defineProperties( asyncPlan , {
		parallelLimit: { value: 1 , writable: false , enumerable: true } ,
		usingIsIterator: { value: true , writable: true , enumerable: true } ,
		execInit: { value: execDoInit.bind( asyncPlan ) } ,
		execNext: { value: execDoNext.bind( asyncPlan ) } ,
		execCallback: { value: execDoCallback } ,
		execLoopCallback: { value: execWhileCallback } ,
		execFinal: { value: execDoFinal.bind( asyncPlan ) }
	} ) ;
	
	if ( arguments.length < 3 )
	{
		// No defaultAggregate given
		iterator = defaultAggregate ;
		defaultAggregate = undefined ;
		
		// Force exec signature to have an aggregateArg
		asyncPlan.execMappingMinInputs = 0 ;
		asyncPlan.execMappingMaxInputs = 100 ;
		asyncPlan.execMappingCallbacks = [ 'finally' ] ;
		asyncPlan.execMappingAggregateArg = true ;
		asyncPlan.execMappingMinArgs = 1 ;
		asyncPlan.execMappingMaxArgs = 102 ;
		asyncPlan.execMappingSignature = '( aggregateArg, [finallyCallback] )' ;
	}
	
	asyncPlan.transmitAggregate = true ;
	asyncPlan.returnAggregate = true ;
	asyncPlan.defaultAggregate = defaultAggregate ;
	
	asyncPlan.do( jobsData ) ;
	asyncPlan.iterator( iterator ) ;
	
	return asyncPlan ;
} ;



// async while
// Here, simple callback is mandatory, since it should process its inputs correctly in order to loop or not
async.while = function _while( whileAction )
{
	var asyncPlan = Object.create( async.Plan.prototype , planCommonProperties ) ;
	
	Object.defineProperties( asyncPlan , {
		waterfallMode: { value: false , enumerable: true } ,
		whileAction: { value: undefined , writable: true , enumerable: true } ,
		whileActionBefore: { value: true , writable: false , enumerable: true } ,
		execInit: { value: execDoInit.bind( asyncPlan ) } ,
		execNext: { value: execDoNext.bind( asyncPlan ) } ,
		execCallback: { value: execDoCallback } ,
		execLoopCallback: { value: execWhileCallback } ,
		execFinal: { value: execDoFinal.bind( asyncPlan ) }
	} ) ;
	
	asyncPlan.while( whileAction ) ;
	
	return asyncPlan ;
} ;



// Create an async AND
async.and = function and( jobsData )
{
	var asyncPlan = Object.create( async.Plan.prototype , planCommonProperties ) ;
	
	Object.defineProperties( asyncPlan , {
		elseAction: { value: undefined , writable: true , enumerable: true } ,
		castToBoolean: { value: false , writable: true , enumerable: true } ,
		useLogicAnd: { value: true } ,
		execInit: { value: execDoInit.bind( asyncPlan ) } ,
		execNext: { value: execDoNext.bind( asyncPlan ) } ,
		execCallback: { value: execLogicCallback } ,
		execLoopCallback: { value: execWhileCallback } ,
		execFinal: { value: execLogicFinal.bind( asyncPlan ) }
	} ) ;
	
	asyncPlan.do( jobsData ) ;
	
	return asyncPlan ;
} ;



// Create an async OR (it's close to AND)
async.or = function or( jobsData )
{
	var asyncPlan = Object.create( async.Plan.prototype , planCommonProperties ) ;
	
	Object.defineProperties( asyncPlan , {
		elseAction: { value: undefined , writable: true , enumerable: true } ,
		castToBoolean: { value: false , writable: true , enumerable: true } ,
		useLogicAnd: { value: false } ,
		execInit: { value: execDoInit.bind( asyncPlan ) } ,
		execNext: { value: execDoNext.bind( asyncPlan ) } ,
		execCallback: { value: execLogicCallback } ,
		execLoopCallback: { value: execWhileCallback } ,
		execFinal: { value: execLogicFinal.bind( asyncPlan ) }
	} ) ;
	
	asyncPlan.do( jobsData ) ;
	
	return asyncPlan ;
} ;



// Syntaxic sugar: various if notations
async.if = function _if( jobsData )
{
	var asyncPlan = Object.create( async.Plan.prototype , planCommonProperties ) ;
	
	Object.defineProperties( asyncPlan , {
		elseAction: { value: true , writable: true , enumerable: true } ,
		castToBoolean: { value: true , writable: true , enumerable: true } ,
		useLogicAnd: { value: true } ,
		execInit: { value: execDoInit.bind( asyncPlan ) } ,
		execNext: { value: execDoNext.bind( asyncPlan ) } ,
		execCallback: { value: execLogicCallback } ,
		execLoopCallback: { value: execWhileCallback } ,
		execFinal: { value: execLogicFinal.bind( asyncPlan ) }
	} ) ;
	
	if ( jobsData ) { asyncPlan.do( jobsData ) ; }
	
	return asyncPlan ;
} ;

async.if.and = async.if ;
async.if.or = function ifOr( jobsData )
{
	var asyncPlan = Object.create( async.Plan.prototype , planCommonProperties ) ;
	
	Object.defineProperties( asyncPlan , {
		elseAction: { value: true , writable: true , enumerable: true } ,
		castToBoolean: { value: true , writable: true , enumerable: true } ,
		useLogicAnd: { value: false } ,
		execInit: { value: execDoInit.bind( asyncPlan ) } ,
		execNext: { value: execDoNext.bind( asyncPlan ) } ,
		execCallback: { value: execLogicCallback } ,
		execLoopCallback: { value: execWhileCallback } ,
		execFinal: { value: execLogicFinal.bind( asyncPlan ) }
	} ) ;
	
	if ( jobsData ) { asyncPlan.do( jobsData ) ; }
	
	return asyncPlan ;
} ;



			////////////////
			// Shorthands //
			////////////////



// Accept only one function, timeout it
// async.timeout( fn , timeout , [maxRetry] , [retryTimeout] , [multiply] , [maxRetryTimeout] )
//async.timeout = function timeout( func , timeoutValue , maxRetry , retryTimeout , multiply , maxRetryTimeout )
async.callTimeout = function callTimeout( timeout , completionCallback , fn , this_ )
{
	if ( typeof fn !== 'function' ) { throw new Error( '[async] async.callTimeout(): argument #0 should be a function' ) ; }
	
	var asyncPlan = Object.create( async.Plan.prototype , planCommonProperties ) ;
	
	Object.defineProperties( asyncPlan , {
		returnLastJobOnly: { value: true , enumerable: true } ,
		jobsTimeout: { value: timeout , writable: true , enumerable: true } ,
		execInit: { value: execDoInit.bind( asyncPlan ) } ,
		execNext: { value: execDoNext.bind( asyncPlan ) } ,
		execCallback: { value: execDoCallback } ,
		execLoopCallback: { value: execWhileCallback } ,
		execFinal: { value: execDoFinal.bind( asyncPlan ) }
	} ) ;
	
	var job = [ fn.bind( this_ ) ].concat( Array.prototype.slice.call( arguments , 4 ) ) ;
	asyncPlan.do( [ job ] ) ;
	
	//if ( arguments.length > 2 ) { asyncPlan.retry( maxRetry , retryTimeout , multiply , maxRetryTimeout ) ; }
	
	return asyncPlan.exec( completionCallback ) ;
} ;



			///////////////////////
			// Async Plan object //
			///////////////////////



// Set the job's list
async.Plan.prototype.do = function _do( jobsData )
{
	if ( this.locked ) { return this ; }
	
	if ( jobsData && typeof jobsData === 'object' ) { this.jobsData = jobsData ; }
	else if ( typeof jobsData === 'function' )  { this.jobsData = [ jobsData ] ; this.returnLastJobOnly = true ; }
	else { this.jobsData = {} ; }
	
	this.jobsKeys = Object.keys( this.jobsData ) ;
	
	return this ;
} ;



// Set number of jobs running in parallel
async.Plan.prototype.parallel = function parallel( parallelLimit )
{
	if ( this.locked ) { return this ; }
	
	if ( parallelLimit === undefined || parallelLimit === true ) { this.parallelLimit = Infinity ; }
	else if ( parallelLimit === false ) { this.parallelLimit = 1 ; }
	else if ( typeof parallelLimit === 'number' ) { this.parallelLimit = parallelLimit ; }
	
	return this ;
} ;



// Set race mode: we stop processing jobs when the first non-error job finish.
// Notice: when using race() this way (without the async.race() factory), you have to call .fatal( false ) too if you want the same behaviour.
async.Plan.prototype.race = function race( raceMode )
{
	if ( ! this.locked ) { this.raceMode = raceMode || raceMode === undefined ? true : false ; }
	return this ;
} ;



// Set waterfall mode: each job pass its results to the next job.
// Be careful, this does not support parallel mode ATM, but may fail silently.
// TODO: should probably raise an exception if we use parallel mode.
async.Plan.prototype.waterfall = function waterfall( waterfallMode )
{
	if ( ! this.locked ) { this.waterfallMode = waterfallMode || waterfallMode === undefined ? true : false ; }
	return this ;
} ;



// Set while action.
// Here, simple callback is mandatory, since it should process its inputs correctly in order to loop or not.
// If whileActionBefore is given and truthy, then it makes a do( jobs ).while( callback , true ) the same as while( whileAction ).do( jobs ):
// the while condition is evaluated before any jobs are processed.
// Write this form only for non-trivial uses.
async.Plan.prototype.while = function _while( whileAction , whileActionBefore )
{
	if ( this.locked ) { return this ; }
	this.whileAction = whileAction ;
	if ( whileActionBefore !== undefined ) { this.whileActionBefore = whileActionBefore ? true : false ; }
	return this ;
} ;



// Set the number of time to repeat the action.
// It is the same as while(), provided with a simple counter function.
async.Plan.prototype.repeat = function repeat( n )
{
	if ( this.locked ) { return this ; }
	
	var i = 0 ;
	
	if ( typeof n !== 'number' ) { n = parseInt( n ) ; }
	this.whileActionBefore = true ;
	
	this.whileAction = function( error , results , callback ) {
		// callback should be called last, to avoid sync vs async mess, hence i++ come first, and we check i<=n rather than i<n
		i ++ ;
		callback( i <= n ) ;
	} ;
	
	return this ;
} ;



// Set if errors are fatal or not
async.Plan.prototype.fatal = function fatal( errorsAreFatal )
{
	if ( ! this.locked ) { this.errorsAreFatal = errorsAreFatal || errorsAreFatal === undefined ? true : false ; }
	return this ;
} ;



// Cast logic jobs to boolean
async.Plan.prototype.boolean = function boolean( castToBoolean )
{
	if ( ! this.locked ) { this.castToBoolean = castToBoolean || castToBoolean === undefined ? true : false ; }
	return this ;
} ;



// Transmit error, in waterfall mode
async.Plan.prototype.transmitError = function transmitError( waterfallTransmitError )
{
	if ( ! this.locked ) { this.waterfallTransmitError = waterfallTransmitError || waterfallTransmitError === undefined ? true : false ; }
	return this ;
} ;



// Set the timeout for each jobs, the callback will be called with an async error for each of them that timeout
async.Plan.prototype.timeout = function timeout( jobsTimeout )
{
	if ( ! this.locked )
	{
		if ( typeof jobsTimeout === 'number' ) { this.jobsTimeout = jobsTimeout ; }
		else { this.jobsTimeout = undefined ; }
	}
	return this ;
} ;



// Set how to retry jobs in error
async.Plan.prototype.retry = function retry( maxRetry , timeout , multiply , maxTimeout )
{
	if ( this.locked ) { return this ; }
	
	if ( typeof maxRetry === 'number' ) { this.maxRetry = maxRetry ; }
	if ( typeof timeout === 'number' ) { this.retryTimeout = timeout ; }
	if ( typeof multiply === 'number' ) { this.retryMultiply = multiply ; }
	if ( typeof maxTimeout === 'number' ) { this.retryMaxTimeout = maxTimeout ; }
	
	return this ;
} ;



// Set if only the last job's results should be passed to the callback
async.Plan.prototype.lastJobOnly = function lastJobOnly( returnLastJobOnly )
{
	if ( ! this.locked ) { this.returnLastJobOnly = returnLastJobOnly || returnLastJobOnly === undefined ? true : false ; }
	return this ;
} ;



// Set if the result mapping should match the jobs' data 1:1
async.Plan.prototype.mapping1to1 = function mapping1to1( returnMapping1to1 )
{
	if ( ! this.locked ) { this.returnMapping1to1 = returnMapping1to1 || returnMapping1to1 === undefined ? true : false ; }
	return this ;
} ;



// Set the performer of the jobs: if set, do() is not feeded by callback but by arguments for this single callback function.
// The performer function should accept a callback as its last argument, in the nodejs' way.
async.Plan.prototype.using = function using( jobsUsing )
{
	if ( ! this.locked ) { this.jobsUsing = jobsUsing ; }
	return this ;
} ;



// Same as using(), but the given function receive an uniq "element" containing the whole job as its first argument:
// it is like using().usingIterator(), a behaviour similar to the async.foreach() factory
async.Plan.prototype.iterator = function iterator( iterator_ )
{
	if ( this.locked ) { return this ; }
	this.jobsUsing = iterator_ ;
	this.usingIsIterator = true ;
	return this ;
} ;



// Transmit aggregate, for aggregator mode (reduce, etc)
async.Plan.prototype.aggregator = function aggregator( transmitAggregate , returnAggregate , defaultAggregate )
{
	if ( ! this.locked )  { return this ; }
	this.transmitAggregate = transmitAggregate || transmitAggregate === undefined ? true : false ;
	this.returnAggregate = returnAggregate || returnAggregate === undefined ? true : false ;
	if ( arguments.length > 2 )  { this.defaultAggregate = defaultAggregate ; }
	return this ;
} ;



// Set if using() is an iterator (like async.foreach()), if so, the whole job is transmitted as one argument rather than an argument list
// NODOC
async.Plan.prototype.usingIterator = function usingIterator( usingIsIterator )
{
	if ( ! this.locked )  { this.usingIsIterator = usingIsIterator || usingIsIterator === undefined ? true : false ; }
	return this ;
} ;



// Set the async'ness of the flow, even sync jobs can be turned async
async.Plan.prototype.nice = function nice( asyncEventNice )
{
	if ( this.locked ) { return this ; }
	
	if ( asyncEventNice === undefined || asyncEventNice === null || asyncEventNice === true ) { this.asyncEventNice = -1 ; }
	else if ( asyncEventNice === false ) { this.asyncEventNice = -20 ; }
	else { this.asyncEventNice = asyncEventNice ; }
	
	return this ;
} ;



// Set action to do on completion.
// If catch() or else() are present and match, then() is not triggered.
async.Plan.prototype.then = function then( thenAction )
{
	if ( ! this.locked ) { this.thenAction = thenAction ; }
	return this ;
} ;



// Set action to do on logical false status
async.Plan.prototype.else = function _else( elseAction )
{
	if ( ! this.locked ) { this.elseAction = elseAction || true ; }
	return this ;
} ;



// Set action to do on error
async.Plan.prototype.catch = function _catch( catchAction )
{
	if ( ! this.locked ) { this.catchAction = catchAction || true ; }
	return this ;
} ;



// Set action to do, that trigger whether it has triggered or not any of then()/catch()/else()
async.Plan.prototype.finally = function _finally( finallyAction )
{
	if ( ! this.locked ) { this.finallyAction = finallyAction || true ; }
	return this ;
} ;



// Return a clone of the object
async.Plan.prototype.clone = function clone()
{
	var asyncPlan = Object.create( async.Plan.prototype , planCommonProperties ) ;
	treeExtend( null , asyncPlan , this ) ;
	asyncPlan.locked = false ;
	return asyncPlan ;
} ;



// Export the async.Plan object as an async function, so it can be called later at will
async.Plan.prototype.export = function _export( execMethod )
{
	switch ( execMethod )
	{
		case 'execFinally' :
			return this.clone().execFinally.bind( this ) ;
		case 'execThenCatch' :
			return this.clone().execThenCatch.bind( this ) ;
		case 'execThenElse' :
			return this.clone().execThenElse.bind( this ) ;
		case 'execThenElseCatch' :
			return this.clone().execThenElseCatch.bind( this ) ;
		case 'execArgs' :
			return this.clone().execArgs.bind( this ) ;
		case 'execKV' :
			return this.clone().execKV.bind( this ) ;
		default :
			return this.clone().exec.bind( this ) ;
	}
} ;



// This is the common exec() function, its arguments can be mapped using execMapping()
async.Plan.prototype.exec = function exec()
{
	var config = { inputs: [] , callbacks: {} } , offset = 0 , i ;
	
	if ( arguments.length < this.execMappingMinArgs )
	{
		throw new Error( "[async] Too few arguments, in this instance, the function signature is: fn" + this.execMappingSignature ) ;
	}
	else if ( arguments.length > this.execMappingMaxArgs )
	{
		throw new Error( "[async] Too much arguments, in this instance, the function signature is: fn" + this.execMappingSignature ) ;
	}
	
	if ( this.execMappingAggregateArg )
	{
		offset ++ ;
		config.aggregate = arguments[ 0 ] ;
	}
	
	if ( this.execMappingMinInputs === this.execMappingMaxInputs )
	{
		// Fixed arguments count, variable callback count possible
		config.inputs = Array.prototype.slice.call( arguments , offset , this.execMappingMaxInputs + offset ) ;
		
		for ( i = 0 ; i < this.execMappingCallbacks.length && config.inputs.length + i < arguments.length ; i ++ )
		{
			config.callbacks[ this.execMappingCallbacks[ i ] ] = arguments[ config.inputs.length + offset + i ] ;
		}
	}
	else
	{
		// Variable arguments count, fixed callback count
		config.inputs = Array.prototype.slice.call( arguments , offset , - this.execMappingCallbacks.length ) ;
		
		for ( i = 0 ; i < this.execMappingCallbacks.length ; i ++ )
		{
			config.callbacks[ this.execMappingCallbacks[ i ] ] = arguments[ config.inputs.length + offset + i ] ;
		}
	}
	
	return this.execInit( config ) ;
} ;



// Exec templates
async.Plan.prototype.execFinally = function execFinally( finallyCallback )
{
	return this.execInit( { inputs: [] , callbacks: { 'finally': finallyCallback } } ) ;
} ;



async.Plan.prototype.execThenCatch = function execThenCatch( thenCallback , catchCallback , finallyCallback )
{
	return this.execInit( { inputs: [] , callbacks: { 'then': thenCallback , 'catch': catchCallback , 'finally': finallyCallback } } ) ;
} ;



async.Plan.prototype.execThenElse = function execThenElse( thenCallback , elseCallback , finallyCallback )
{
	return this.execInit( { inputs: [] , callbacks: { 'then': thenCallback , 'else': elseCallback , 'finally': finallyCallback } } ) ;
} ;



async.Plan.prototype.execThenElseCatch = function execThenElseCatch( thenCallback , elseCallback , catchCallback , finallyCallback )
{
	return this.execInit( { inputs: [] , callbacks: { 'then': thenCallback , 'else': elseCallback , 'catch': catchCallback , 'finally': finallyCallback } } ) ;
} ;



async.Plan.prototype.execArgs = function execArgs()
{
	return this.execInit( { inputs: arguments , callbacks: {} } ) ;
} ;



// Configure the inputs of exec() function
// .callbacks
// .minInputs
// .maxInputs
// .inputsName
// .aggregateArg
async.Plan.prototype.execMapping = function execMapping( config )
{
	if ( this.locked )  { return this ; }
	
	config = treeExtend( null , { minInputs: 0 , maxInputs: 0 } , config ) ;
	
	var i , j , maxUnnamed = 5 ;
	
	config.minInputs = parseInt( config.minInputs ) ;
	config.maxInputs = parseInt( config.maxInputs ) ;
	
	if ( config.minInputs < config.maxInputs )
	{
		this.execMappingMinInputs = config.minInputs ;
		this.execMappingMaxInputs = config.maxInputs ;
	}
	else
	{
		// User is stOopid, swap...
		this.execMappingMinInputs = config.maxInputs ;
		this.execMappingMaxInputs = config.minInputs ;
	}
	
	this.execMappingCallbacks = Array.isArray( config.callbacks ) ? config.callbacks : [] ;
	this.execMappingInputsName = Array.isArray( config.inputsName ) ? config.inputsName : [] ;
	this.execMappingSignature = '( ' ;
	
	if ( this.execMappingMinInputs === this.execMappingMaxInputs )
	{
		// Fixed input count, variable callback count possible
		this.execMappingMinArgs = this.execMappingMinInputs ;
		this.execMappingMaxArgs = this.execMappingMaxInputs + this.execMappingCallbacks.length ;
		
		if ( config.aggregateArg )
		{
			this.execMappingAggregateArg = config.aggregateArg ;
			this.execMappingMinArgs ++ ;
			this.execMappingMaxArgs ++ ;
			this.execMappingSignature += 'aggregateValue' ;
		}
		
		for ( i = 0 ; i < this.execMappingMaxInputs ; i ++ )
		{
			if ( i > 0 || config.aggregateArg )  { this.execMappingSignature += ', ' ; }
			if ( i >= maxUnnamed && typeof this.execMappingInputsName[ i ] !== 'string' )  { this.execMappingSignature += '... ' ; break ; }
			
			this.execMappingSignature += typeof this.execMappingInputsName[ i ] === 'string' ? this.execMappingInputsName[ i ] : 'arg#' + ( i + 1 ) ;
		}
		
		for ( j = 0 ; j < this.execMappingCallbacks.length ; j ++ )
		{
			if ( i + j > 0 || config.aggregateArg )  { this.execMappingSignature += ', ' ; }
			this.execMappingSignature += '[' + this.execMappingCallbacks[ j ] + 'Callback]' ;
		}
	}
	else
	{
		// Variable input count, fixed callback count
		this.execMappingMinArgs = this.execMappingMinInputs + this.execMappingCallbacks.length ;
		this.execMappingMaxArgs = this.execMappingMaxInputs + this.execMappingCallbacks.length ;
		
		if ( config.aggregateArg )
		{
			this.execMappingAggregateArg = config.aggregateArg ;
			this.execMappingMinArgs ++ ;
			this.execMappingMaxArgs ++ ;
			this.execMappingSignature += 'aggregateValue' ;
		}
		
		for ( i = 0 ; i < this.execMappingMaxInputs ; i ++ )
		{
			if ( i > 0 || config.aggregateArg )  { this.execMappingSignature += ', ' ; }
			
			if ( i < this.execMappingMinInputs )
			{
				if ( i >= maxUnnamed && typeof this.execMappingInputsName[ i ] !== 'string' )  { this.execMappingSignature += '... ' ; break ; }
				this.execMappingSignature += typeof this.execMappingInputsName[ i ] === 'string' ? this.execMappingInputsName[ i ] : 'arg#' + ( i + 1 ) ;
			}
			else
			{
				if ( i >= maxUnnamed && typeof this.execMappingInputsName[ i ] !== 'string' )  { this.execMappingSignature += '[...] ' ; break ; }
				this.execMappingSignature += '[' + ( typeof this.execMappingInputsName[ i ] === 'string' ? this.execMappingInputsName[ i ] : 'arg#' + ( i + 1 ) ) + ']' ;
			}
		}
		
		for ( j = 0 ; j < this.execMappingCallbacks.length ; j ++ )
		{
			if ( i + j > 0 || config.aggregateArg )  { this.execMappingSignature += ', ' ; }
			this.execMappingSignature += this.execMappingCallbacks[ j ] + 'Callback' ;
		}
	}
	
	this.execMappingSignature += ' )' ;
	
	return this ;
} ;



// More sage and deterministic exec(), with all arguments given into a single object
async.Plan.prototype.execKV = function execKV( config )
{
	if ( config.inputs === undefined )  { config.inputs = [] ; }
	else if ( ! Array.isArray( config.inputs ) )  { config.inputs = [ config.inputs ] ; }
	
	if ( config.callbacks === undefined || typeof config.callbacks !== 'object' )  { config.callbacks = {} ; }
	if ( config.then )  { config.callbacks.then = config.then ; }
	if ( config.else )  { config.callbacks.else = config.else ; }
	if ( config.catch )  { config.callbacks.catch = config.catch ; }
	if ( config.finally )  { config.callbacks.finally = config.finally ; }
	
	// Nothing to do here, user is free to pass whatever is needed
	//if ( config.aggregate === undefined )  { config.aggregate = null ; }
	
	return this.execInit( config ) ;
} ;



// Internal, what to do on new loop iteration
async.Plan.prototype.execLoop = function execLoop( fromExecContext ) { return this.execInit( {} , fromExecContext ) ; } ;



// Internal exec of callback-like job/action
async.Plan.prototype.execJob = function execJob( execContext , job , indexOfKey , tryIndex )
{
	var self = this , args , key = execContext.jobsKeys[ indexOfKey ] ;
	
	// Create the job's context
	var jobContext = Object.create( async.JobContext.prototype , {
		execContext: { value: execContext , enumerable: true } ,
		indexOfKey: { value: indexOfKey , enumerable: true } ,
		tryIndex: { value: tryIndex , enumerable: true } ,
		aborted: { value: false , writable: true , enumerable: true } ,
		abortedLoop: { value: false , writable: true , enumerable: true }
	} ) ;
	
	// Add the callback to the context
	Object.defineProperty( jobContext , 'callback' , {
		value: this.execCallback.bind( this , jobContext ) ,
		enumerable: true
	} ) ;
	
	// Also add the jobContext into the bounded function: it's an alternate way to access a job's context.
	Object.defineProperty( jobContext.callback , 'jobContext' , {
		value: jobContext ,
		enumerable: true
	} ) ;
	
	
	// Set the current job's status to 'pending'
	execContext.jobsStatus[ key ].status = 'pending' ;
	execContext.jobsStatus[ key ].tried ++ ;
	
	// Set up the nice value? For instance only syncEmit() are used
	//jobContext.setNice( this.asyncEventNice ) ;
	
	
	if ( typeof this.jobsUsing === 'function' )
	{
		if ( this.usingIsIterator )
		{
			if ( this.transmitAggregate )
			{
				if ( this.jobsUsing.length <= 3 )
				{
					this.jobsUsing.call( jobContext , execContext.aggregate , job , jobContext.callback ) ;
				}
				else if ( this.jobsUsing.length <= 4 )
				{
					this.jobsUsing.call( jobContext , execContext.aggregate , job , Array.isArray( execContext.jobsData ) ? indexOfKey : key , jobContext.callback ) ;
				}
				else
				{
					this.jobsUsing.call( jobContext , execContext.aggregate , job , Array.isArray( execContext.jobsData ) ? indexOfKey : key , execContext.jobsData , jobContext.callback ) ;
				}
			}
			else
			{
				if ( this.jobsUsing.length <= 2 )
				{
					this.jobsUsing.call( jobContext , job , jobContext.callback ) ;
				}
				else if ( this.jobsUsing.length <= 3 )
				{
					this.jobsUsing.call( jobContext , job , Array.isArray( execContext.jobsData ) ? indexOfKey : key , jobContext.callback ) ;
				}
				else
				{
					this.jobsUsing.call( jobContext , job , Array.isArray( execContext.jobsData ) ? indexOfKey : key , execContext.jobsData , jobContext.callback ) ;
				}
			}
		}
		else if ( Array.isArray( job ) )
		{
			args = job.slice() ;
			
			if ( this.transmitAggregate )  { args.unshift( execContext.aggregate ) ; }
			
			args.push( jobContext.callback ) ;
			this.jobsUsing.apply( jobContext , args ) ;
		}
		else
		{
			this.jobsUsing.call( jobContext , job , jobContext.callback ) ;
		}
	}
	else if ( typeof job === 'function' )
	{
		if ( this.waterfallMode && indexOfKey > 0 )
		{
			// remove the first, error arg if waterfallTransmitError is false
			//console.log( index , key , execContext.results ) ;
			args = execContext.results[ execContext.jobsKeys[ indexOfKey - 1 ] ].slice( this.waterfallTransmitError ? 0 : 1 ) ;
			args.push( jobContext.callback ) ;
			job.apply( jobContext , args ) ;
		}
		else if ( Array.isArray( this.jobsUsing ) || this.execMappingMaxInputs )
		{
			if ( Array.isArray( this.jobsUsing ) ) { args = treeExtend( null , [] , this.jobsUsing , execContext.execInputs ) ; }
			else { args = treeExtend( null , [] , execContext.execInputs ) ; }
			
			args.push( jobContext.callback ) ;
			job.apply( jobContext , args ) ;
		}
		else
		{
			job.call( jobContext , jobContext.callback ) ;
		}
	}
	else if ( Array.isArray( job ) && typeof job[ 0 ] === 'function' )
	{
		args = job.slice( 1 ) ;
		args.push( jobContext.callback ) ;
		job[ 0 ].apply( jobContext , args ) ;
	}
	else if ( typeof job === 'object' && job instanceof async.Plan )
	{
		// What to do with jobUsing and execContext.execInputs here? Same as if( typeof job === 'function' ) ?
		job.exec( jobContext.callback ) ;
	}
	else
	{
		this.execCallback.call( this , jobContext ) ;
		return this ;
	}
	
	
	// Timers management
	if ( execContext.jobsTimeoutTimers[ key ] !== undefined )
	{
		clearTimeout( execContext.jobsTimeoutTimers[ key ] ) ;
		execContext.jobsTimeoutTimers[ key ] = undefined ;
	}
	
	if ( execContext.retriesTimers[ key ] !== undefined )
	{
		clearTimeout( execContext.retriesTimers[ key ] ) ;
		execContext.retriesTimers[ key ] = undefined ;
	}
	
	if ( typeof this.jobsTimeout === 'number' && this.jobsTimeout !== Infinity )
	{
		execContext.jobsTimeoutTimers[ key ] = setTimeout( function() {
			execContext.jobsTimeoutTimers[ key ] = undefined ;
			execContext.jobsStatus[ key ].status = 'timeout' ;
			jobContext.emit( 'timeout' ) ;
			self.execCallback.call( self , jobContext , new async.AsyncError( 'jobTimeout' ) ) ;
		} , this.jobsTimeout ) ;
	}
	
	return this ;
} ;



// Internal exec of callback-like action
async.Plan.prototype.execAction = function execAction( execContext , action , args )
{
	// call the matching action
	if ( typeof action === 'function' )
	{
		action.apply( execContext , args ) ;
	}
	else if ( typeof action === 'object' && action instanceof async.Plan )
	{
		action.exec() ;
	}
} ;



			/////////////////////////////////////////////////////////////////////////
			// Async JobContext: Context of a job execution, transmitted as *this* //
			/////////////////////////////////////////////////////////////////////////



// Empty constructor, it is just there to support instanceof operator
async.JobContext = function JobContext()
{
	throw new Error( "[async] Cannot create an async JobContext object directly" ) ;
} ;

// Extends it from EventEmitter
async.JobContext.prototype = Object.create( NextGenEvents.prototype ) ;
async.JobContext.prototype.constructor = async.JobContext ;



// Permit a userland-side abort of the job's queue
async.JobContext.prototype.abort = function abort()
{
	this.aborted = true ;
	this.callback.apply( undefined , arguments ) ;
} ;



// Permit a userland-side abort of the job's queue, and event the whole loop
async.JobContext.prototype.abortLoop = function abortLoop()
{
	this.aborted = true ;
	this.abortedLoop = true ;
	this.callback.apply( undefined , arguments ) ;
} ;



			//////////////////////////////////////////////////
			// Async ExecContext: Context of plan execution //
			//////////////////////////////////////////////////



// Empty constructor, it is just there to support instanceof operator
async.ExecContext = function ExecContext()
{
	throw new Error( "[async] Cannot create an async ExecContext object directly" ) ;
} ;

// Extends it from EventEmitter
async.ExecContext.prototype = Object.create( NextGenEvents.prototype ) ;
async.ExecContext.prototype.constructor = async.ExecContext ;



// This is used to complete jobsStatus only on-demand, so big data that are not object (e.g. big string)
// does not get duplicated for nothing
async.ExecContext.prototype.getJobsStatus = function getJobsStatus()
{
	var i , key , fullJobsStatus = Array.isArray( this.jobsData ) ? [] : {} ;
	
	for ( i = 0 ; i < this.jobsKeys.length ; i ++ )
	{
		key = this.jobsKeys[ i ] ;
		
		fullJobsStatus[ key ] = treeExtend( null , {
				job: this.jobsData[ key ] ,
				result: this.results[ key ]
			} ,
			this.jobsStatus[ key ]
		) ;
	}
	
	return fullJobsStatus ;
} ;



function execDoInit( config , fromExecContext )
{
	var i , isArray = Array.isArray( this.jobsData ) ;
	
	// Create instanceof ExecContext
	var execContext = Object.create( async.ExecContext.prototype , {
		plan: { value: this } ,
		aggregate: { value: ( 'aggregate' in config  ? config.aggregate : this.defaultAggregate ) , writable: true , enumerable: true } ,
		results: { value: ( isArray ? [] : {} ) , writable: true , enumerable: true } ,
		result: { value: undefined , writable: true , enumerable: true } , // Conditionnal version
		jobsTimeoutTimers: { value: ( isArray ? [] : {} ) , writable: true } ,
		jobsStatus: { value: ( isArray ? [] : {} ) , writable: true , enumerable: true } ,
		retriesTimers: { value: ( isArray ? [] : {} ) , writable: true } ,
		retriesCounter: { value: ( isArray ? [] : {} ) , writable: true , enumerable: true } ,
		tryUserResponseCounter: { value: ( isArray ? [] : {} ) , writable: true , enumerable: true } ,
		tryResponseCounter: { value: ( isArray ? [] : {} ) , writable: true , enumerable: true } ,
		iterator: { value: 0 , writable: true , enumerable: true } ,
		pending: { value: 0 , writable: true , enumerable: true } ,
		resolved: { value: 0 , writable: true , enumerable: true } ,
		ok: { value: 0 , writable: true , enumerable: true } ,
		failed: { value: 0 , writable: true , enumerable: true } ,
		status: { value: undefined , writable: true , enumerable: true } ,
		error: { value: undefined , writable: true , enumerable: true } ,
		statusTriggerJobsKey: { value: undefined , writable: true , enumerable: true } ,
		whileStatus: { value: undefined , writable: true } ,
			// true if current execContext has looped in another execContext (one loop per execContext possible)
			// false if this execContext will never loop, undefined if this isn't settled
		whileChecked: { value: false , writable: true }
	} ) ;
	
	// Add some properties depending on inherited ExecContext or not
	if ( ! fromExecContext )
	{
		// This is the top-level/first ExecContext
		Object.defineProperties( execContext , {
			root: { value: execContext , enumerable: true } ,
			jobsData: {
				value: ( isArray ? this.jobsData.slice(0) : treeExtend( null , {} , this.jobsData ) ) ,
				enumerable: true
			} ,
			jobsKeys: { value: this.jobsKeys.slice(0) , enumerable: true } ,
			execInputs: { value: config.inputs , enumerable: true } ,
			execCallbacks: { value: config.callbacks } ,
			whileIterator: { value: 0 , enumerable: true , writable: true }
		} ) ;
	}
	else
	{
		// This is a loop, and this ExecContext is derived from the first one
		Object.defineProperties( execContext , {
			root: { value: fromExecContext.root , enumerable: true } ,
			jobsData: { value: fromExecContext.jobsData , enumerable: true } ,
			jobsKeys: { value: fromExecContext.jobsKeys , enumerable: true } ,
			execInputs: { value: fromExecContext.execInputs , enumerable: true } ,
			execCallbacks: { value: fromExecContext.execCallbacks } ,
			whileIterator: { value: fromExecContext.whileIterator + 1 , enumerable: true , writable: true }
		} ) ;
	}
	
	// Add more properties depending on previous properties
	Object.defineProperties( execContext , {
		waiting: { value: execContext.jobsKeys.length , writable: true , enumerable: true }
	} ) ;
	
	// Init the jobsStatus
	for ( i = 0 ; i < execContext.jobsKeys.length ; i ++ )
	{
		execContext.jobsStatus[ execContext.jobsKeys[ i ] ] = {
			status: 'waiting' ,
			errors: [] ,
			tried: 0
		} ;
	}
	
	// Set up the nice value
	execContext.setNice( this.asyncEventNice ) ;
	
	
	// Initialize event listeners, only the first time
	if ( fromExecContext === undefined )
	{
		// Register execFinal to the 'resolved' event
		execContext.root.on( 'resolved' , this.execFinal.bind( this , execContext ) ) ;
		
		
		// Register whileAction to the 'while' event and exec to the 'nextLoop' event
		// Here, simple callback is mandatory
		if ( typeof this.whileAction === 'function' )
		{
			execContext.root.on( 'while' , this.whileAction.bind( this ) ) ;
			execContext.root.on( 'nextLoop' , this.execLoop.bind( this ) ) ;
		}
		else
		{
			this.whileAction = undefined ; // falsy value: do not trigger while code
			execContext.whileStatus = false ; // settle while status to false
		}
		
		
		// Register execNext to the next event
		execContext.root.on( 'next' , this.execNext.bind( this ) ) ;
		
		
		// If we are in a async.while().do() scheme, start whileAction before doing anything
		if ( this.whileAction && this.whileActionBefore )
		{
			execContext.whileIterator = -1 ;
			execContext.root.emit( 'while' , execContext.error , execContext.results , this.execLoopCallback.bind( this , execContext ) , null ) ;
			return this ;
		}
	}
	
	// If no jobs are provided, then exit right now
	if ( execContext.jobsKeys.length <= 0 )
	{
		execContext.root.emit( 'resolved' , execContext.error , execContext.results ) ;
		execContext.root.emit( 'progress' , {
				resolved: execContext.resolved ,
				ok: execContext.ok ,
				failed: execContext.failed ,
				pending: execContext.pending ,
				waiting: execContext.waiting ,
				loop: execContext.whileIterator
			} ,
			execContext.error , execContext.results
		) ;
		execContext.root.emit( 'finish' , execContext.error , execContext.results ) ;
		return execContext.root ;
	}
	
	// Run...
	execContext.root.emit( 'next' , execContext ) ;
	
	// If uncommented, «if» will emit a «progress» event too, which we don't want
	//execContext.root.emit( 'progress' , { resolved: execContext.resolved , pending: execContext.pending , waiting: execContext.waiting , loop: execContext.whileIterator } , execContext.results ) ;
	
	return execContext.root ;
}



// Iterator/next
function execDoNext( execContext )
{
	var indexOfKey , key , length = execContext.jobsKeys.length , startIndex , endIndex ;
	
	startIndex = execContext.iterator ;
	
	for ( ; execContext.iterator < length && execContext.pending < this.parallelLimit ; execContext.iterator ++ )
	{
		execContext.pending ++ ;
		execContext.waiting -- ;
		
		// Current key...
		indexOfKey = execContext.iterator ;
		key = execContext.jobsKeys[ indexOfKey ] ;
		
		// Set retriesCounter[] to 0 for this key
		execContext.retriesCounter[ key ] = 0 ;
		
		// Create the retries array for this key
		execContext.tryResponseCounter[ key ] = [] ;
		execContext.tryResponseCounter[ key ][ 0 ] = 0 ;
		execContext.tryUserResponseCounter[ key ] = [] ;
		execContext.tryUserResponseCounter[ key ][ 0 ] = 0 ;
		
		// This is to make the result's keys in the same order than the jobs's keys
		execContext.results[ key ] = undefined ;
		
		// execJob() later, or synchronous jobs will mess up the current code flow
		
		endIndex = execContext.iterator ;
	}
	
	// Defered execution of jobs
	for ( indexOfKey = startIndex ; indexOfKey <= endIndex ; indexOfKey ++ )
	{
		this.execJob( execContext , execContext.jobsData[ execContext.jobsKeys[ indexOfKey ] ] , indexOfKey , 0 ) ;
	}
}



// Result callback
function execDoCallback( jobContext , error )
{
	var execContext = jobContext.execContext ,
		aborted = jobContext.aborted ,
		abortedLoop = jobContext.abortedLoop ,
		indexOfKey = jobContext.indexOfKey ,
		tryIndex = jobContext.tryIndex ;
	
	var self = this , timeout , nextTryIndex , length = execContext.jobsKeys.length , key = execContext.jobsKeys[ indexOfKey ] ;
	
	// Emit() are postponed at the end of the function: we want a consistent flow, wheither we are running sync or async
	var emitNext = false , emitResolved = false , emitFinish = false , emitWhile = false ;
	
	// Increment the current tryResponseCounter and tryUserResponseCounter
	execContext.tryResponseCounter[ key ][ tryIndex ] ++ ;
	if ( ! ( error instanceof async.AsyncError ) ) { execContext.tryUserResponseCounter[ key ][ tryIndex ] ++ ; }
	
	// Clear timers if needed
	if ( execContext.jobsTimeoutTimers[ key ] !== undefined )
	{
		clearTimeout( execContext.jobsTimeoutTimers[ key ] ) ;
		execContext.jobsTimeoutTimers[ key ] = undefined ;
	}
	
	if ( execContext.retriesTimers[ key ] !== undefined )
	{
		clearTimeout( execContext.retriesTimers[ key ] ) ;
		execContext.retriesTimers[ key ] = undefined ;
	}
	
	
	/*
	console.log( "\n  key: " , key ) ;
	console.log( "    retriesCounter: " , execContext.retriesCounter[ key ] , "/" , this.maxRetry ) ;
	console.log( "    tryIndex: " , tryIndex ) ;
	console.log( "    tryResponseCounter: " , execContext.tryResponseCounter[ key ][ tryIndex ] ) ;
	console.log( "    tryUserResponseCounter: " , execContext.tryUserResponseCounter[ key ][ tryIndex ] ) ;
	//*/
	
	//console.log( "    --> No result yet" ) ;
	
	// User code shouldn't call the callback more than once... even abort() is cancelled here
	if ( execContext.tryUserResponseCounter[ key ][ tryIndex ] > 1 )
	{
		execContext.jobsStatus[ key ].errors.push( new Error( 'This job has called its completion callback ' + execContext.tryUserResponseCounter[ key ][ tryIndex ] + ' times' ) ) ;
		return ;
	}
	
	// The callback has already been called for this job: either a user error or a timeout reach there before this job completion
	// Not sure if this case still exists
	if ( ! aborted && execContext.results[ key ] !== undefined )
	{
		return ;
	}
	//console.log( "    --> First user's response" ) ;
	
	// Eventually retry on error, if we can retry this job and if this try has not triggered another retry yet
	if ( ! aborted && error && this.maxRetry > execContext.retriesCounter[ key ] && execContext.tryResponseCounter[ key ][ tryIndex ] <= 1 )
	{
		// First "log" the error in the jobsStatus
		execContext.jobsStatus[ key ].errors.push( error ) ;
		
		timeout = this.retryTimeout * Math.pow( this.retryMultiply , execContext.retriesCounter[ key ] ) ;
		if ( timeout > this.retryMaxTimeout ) { timeout = this.retryMaxTimeout ; }
		
		/*
		console.log( "\n    Retry for key: " , key ) ;
		console.log( "      retryMultiply: " , this.retryMultiply ) ;
		console.log( "      retriesCounter: " , execContext.retriesCounter[ key ] ) ;
		console.log( "      timeout: " , timeout ) ;
		//*/
		
		execContext.retriesCounter[ key ] ++ ;
		nextTryIndex = execContext.retriesCounter[ key ] ;
		//console.log( "      nextTryIndex: " , nextTryIndex ) ;
		
		execContext.retriesTimers[ key ] = setTimeout( function() {
			//console.log( "    Retry Timeout triggered... for key: " , key ) ;
			execContext.retriesTimers[ key ] = undefined ;
			execContext.tryResponseCounter[ key ][ nextTryIndex ] = 0 ;
			execContext.tryUserResponseCounter[ key ][ nextTryIndex ] = 0 ;
			self.execJob( execContext , execContext.jobsData[ key ] , indexOfKey , nextTryIndex ) ;
		} , timeout ) ;
		
		return ;
	}
	//console.log( "    --> Don't have to retry" ) ;
	
	// If it is an error and posterior tries are in progress
	if ( ! aborted && error && tryIndex < execContext.retriesCounter[ key ] ) { return ; }
	//console.log( "    --> Can proceed results" ) ;
	
	
	// Update stats & results
	execContext.resolved ++ ;
	execContext.pending -- ;
	execContext.aggregate = arguments[ 2 ] ;
	
	if ( aborted )
	{
		execContext.failed ++ ;
		execContext.jobsStatus[ key ].status = 'aborted' ;
	}
	else if ( error )
	{
		execContext.failed ++ ;
		execContext.jobsStatus[ key ].errors.push( error ) ;
		if ( error instanceof async.AsyncError && error.message === 'jobTimeout' ) { execContext.jobsStatus[ key ].status = 'timeout' ; }
		else { execContext.jobsStatus[ key ].status = 'failed' ; }
	}
	else
	{
		execContext.ok ++ ;
		execContext.jobsStatus[ key ].status = 'ok' ;
	}
	
	if ( this.returnMapping1to1 )  { execContext.results[ key ] = arguments[ 2 ] ; }
	else  { execContext.results[ key ] = Array.prototype.slice.call( arguments , 1 ) ; }
	
	
	// Check immediate success or failure
	if ( execContext.status === undefined )
	{
		if ( this.raceMode && ! error )
		{
			execContext.status = 'ok' ;
			execContext.statusTriggerJobsKey = key ;
			
			if ( this.whileAction && ! abortedLoop ) { emitWhile = true ; }
			else { emitResolved = true ; }
		}
		else if ( ! this.raceMode && error && this.errorsAreFatal )
		{
			execContext.status = 'fail' ;
			execContext.error = error ;
			execContext.statusTriggerJobsKey = key ;
			
			if ( this.whileAction && ! abortedLoop ) { emitWhile = true ; }
			else { emitResolved = true ; }
		}
		else if ( aborted )
		{
			execContext.status = 'aborted' ;
			execContext.statusTriggerJobsKey = key ;
			
			if ( this.whileAction && ! abortedLoop ) { emitWhile = true ; }
			else { emitResolved = true ; }
		}
	}
	
	
	// What to do next?
	if ( execContext.resolved >= length )
	{
		// We have resolved everything
		
		if ( execContext.status === undefined )
		{
			// If still no status, fix the status and emit 'resolved' and 'finish'
			if ( this.raceMode ) { execContext.status = 'fail' ; }
			else { execContext.status = 'ok' ; }
			execContext.statusTriggerJobsKey = key ;
			
			if ( this.whileAction ) { emitWhile = true ; }
			else { emitResolved = emitFinish = true ; }
		}
		else
		{
			// If we are here, whileAction (if any) has already been called
			// So if it is already settled, and false, emit 'finish'
			if ( ! this.whileAction || ( execContext.whileChecked && execContext.whileStatus !== true ) ) { emitFinish = true ; }
		}
	}
	else if ( execContext.status === undefined )
	{
		// Iterate to the next job if status have not been settled (or settled to error in a non-race mode if errors are not fatal)
		if ( execContext.iterator < length ) { emitNext = true ; }
	}
	else if ( execContext.pending <= 0 )
	{
		// No more item are pending, so we can emit 'finish'
		
		// If we are here, whileAction (if any) has already been called
		// So if it is already settled, and false, emit 'finish'
		if ( ! this.whileAction || ( execContext.whileChecked && execContext.whileStatus !== true ) ) { emitFinish = true ; }
	}
	
	// Emit events, the order matter
	if ( emitResolved ) { execContext.root.emit( 'resolved' , execContext.error , execContext.results ) ; }
	if ( emitNext ) { execContext.root.emit( 'next' , execContext ) ; }
	if ( emitWhile ) { execContext.root.emit( 'while' , execContext.error , execContext.results , this.execLoopCallback.bind( this , execContext ) , null ) ; }
	execContext.root.emit( 'progress' , {
			resolved: execContext.resolved ,
			ok: execContext.ok ,
			failed: execContext.failed ,
			pending: execContext.pending ,
			waiting: execContext.waiting ,
			loop: execContext.whileIterator
		} ,
		execContext.error , execContext.results
	) ;
	if ( emitFinish ) { execContext.root.emit( 'finish' , execContext.error , execContext.results ) ; }
}



function execWhileCallback( execContext )
{
	var result , logic ;
	
	// Emit() are postponed at the end of the function: we want a consistent flow, wheither we are running sync or async
	var emitNextLoop = false , emitResolved = false , emitFinish = false ;
	
	// Arguments checking for fn( [Error] , logic )
	if ( arguments.length <= 1 ) { result = undefined ; logic = false ; }
	else if ( arguments[ 1 ] instanceof Error ) { execContext.error = arguments[ 1 ] ; result = arguments[ 1 ] ; logic = false ; }
	else if ( arguments.length <= 2 ) { result = arguments[ 1 ] ; logic = result ? true : false ; }
	else { result = arguments[ 2 ] ; logic = result ? true : false ; }
	
	/*
	console.log( 'execWhileCallback(), logic: ' + logic + ', result: ' + result ) ;
	console.log( arguments ) ;
	*/
	
	if ( logic )
	{
		execContext.whileStatus = true ;
		emitNextLoop = true ;
	}
	else
	{
		execContext.whileStatus = false ;
		emitResolved = true ;
		if ( execContext.pending <= 0 ) { emitFinish = true ; }
	}
	
	// Emit events, the order is important
	if ( emitResolved ) { execContext.root.emit( 'resolved' , execContext.error , execContext.results ) ; }
	if ( emitNextLoop ) { execContext.root.emit( 'nextLoop' , execContext ) ; }
	if ( emitFinish ) { execContext.root.emit( 'finish' , execContext.error , execContext.results ) ; }
	
	execContext.whileChecked = true ;
}



// What to do when the job is resolved
function execDoFinal( execContext , error , results )
{
	var toReturn ;
	
	if ( error )
	{
		// Catch...
		// Should catch() get all the results?
		if ( this.returnAggregate )  { toReturn = [ error , execContext.aggregate ] ; }
		else if ( this.returnLastJobOnly )  { toReturn = results[ execContext.statusTriggerJobsKey ] ; }
		else  { toReturn = [ error , results ] ; }
		
		if ( this.catchAction )  { this.execAction( execContext , this.catchAction , toReturn ) ; }
		if ( error && execContext.execCallbacks.catch )  { this.execAction( execContext , execContext.execCallbacks.catch , toReturn ) ; }
	}
	else
	{
		// Then...
		if ( this.returnAggregate )  { toReturn = [ execContext.aggregate ] ; }
		else if ( this.returnLastJobOnly )  { toReturn = results[ execContext.statusTriggerJobsKey ].slice( 1 ) ; }
		else  { toReturn = [ results ] ; }
		
		if ( this.thenAction )  { this.execAction( execContext , this.thenAction , toReturn ) ; }
		if ( execContext.execCallbacks.then )  { this.execAction( execContext , execContext.execCallbacks.then , toReturn ) ; }
	}
	
	// Finally...
	if ( this.returnAggregate )  { toReturn = [ error , execContext.aggregate ] ; }
	else if ( this.returnLastJobOnly )  { toReturn = results[ execContext.statusTriggerJobsKey ] ; }
	else  { toReturn = [ error , results ] ; }
	
	if ( this.finallyAction )  { this.execAction( execContext , this.finallyAction , toReturn ) ; }
	if ( execContext.execCallbacks.finally )  { this.execAction( execContext , execContext.execCallbacks.finally , toReturn ) ; }
}



// Handle AND & OR
function execLogicCallback( jobContext )
{
	var execContext = jobContext.execContext ,
		indexOfKey = jobContext.indexOfKey ,
		tryIndex = jobContext.tryIndex ;
	
	var self = this , logic , timeout , nextTryIndex , error ,
		length = execContext.jobsKeys.length , key = execContext.jobsKeys[ indexOfKey ] ;
	
	// Emit() are postponed at the end of the function
	var emitNext = false , emitResolved = false , emitFinish = false ;
	
	// Arguments checking for fn( [Error] , logic )
	if ( arguments.length <= 1 ) { execContext.result = undefined ; logic = false ; }
	else if ( arguments[ 1 ] instanceof Error ) { execContext.error = error = arguments[ 1 ] ; execContext.result = arguments[ 1 ] ; logic = false ; }
	else if ( arguments.length <= 2 ) { execContext.result = arguments[ 1 ] ; logic = execContext.result ? true : false ; }
	else { execContext.result = arguments[ 2 ] ; logic = execContext.result ? true : false ; }
	
	
	
	// Increment the current tryResponseCounter and tryUserResponseCounter
	execContext.tryResponseCounter[ key ][ tryIndex ] ++ ;
	if ( ! ( error instanceof async.AsyncError ) ) { execContext.tryUserResponseCounter[ key ][ tryIndex ] ++ ; }
	
	// Clear timers if needed
	if ( execContext.jobsTimeoutTimers[ key ] !== undefined )
	{
		clearTimeout( execContext.jobsTimeoutTimers[ key ] ) ;
		execContext.jobsTimeoutTimers[ key ] = undefined ;
	}
	
	if ( execContext.retriesTimers[ key ] !== undefined )
	{
		clearTimeout( execContext.retriesTimers[ key ] ) ;
		execContext.retriesTimers[ key ] = undefined ;
	}
	
	
	/*
	console.log( "\n  key: " , key ) ;
	console.log( "    retriesCounter: " , execContext.retriesCounter[ key ] , "/" , this.maxRetry ) ;
	console.log( "    tryIndex: " , tryIndex ) ;
	console.log( "    tryResponseCounter: " , execContext.tryResponseCounter[ key ][ tryIndex ] ) ;
	console.log( "    tryUserResponseCounter: " , execContext.tryUserResponseCounter[ key ][ tryIndex ] ) ;
	//*/
	
	// The callback has already been called for this job: either a user error or a timeout reach there before this job completion
	if ( execContext.results[ key ] !== undefined ) { return ; }
	//console.log( "    --> No result yet" ) ;
	
	// User code shouldn't call the callback more than once
	if ( execContext.tryUserResponseCounter[ key ][ tryIndex ] > 1 ) { return ; }
	//console.log( "    --> First user's response" ) ;
	
	// Eventually retry on error, if we can retry this job and if this try has not triggered another retry yet
	if ( error && this.maxRetry > execContext.retriesCounter[ key ] && execContext.tryResponseCounter[ key ][ tryIndex ] <= 1 )
	{
		timeout = this.retryTimeout * Math.pow( this.retryMultiply , execContext.retriesCounter[ key ] ) ;
		if ( timeout > this.retryMaxTimeout ) { timeout = this.retryMaxTimeout ; }
		
		/*
		console.log( "\n    Retry for key: " , key ) ;
		console.log( "      retryMultiply: " , this.retryMultiply ) ;
		console.log( "      retriesCounter: " , execContext.retriesCounter[ key ] ) ;
		console.log( "      timeout: " , timeout ) ;
		//*/
		
		execContext.retriesCounter[ key ] ++ ;
		nextTryIndex = execContext.retriesCounter[ key ] ;
		//console.log( "      nextTryIndex: " , nextTryIndex ) ;
		
		execContext.retriesTimers[ key ] = setTimeout( function() {
			//console.log( "    Retry Timeout triggered... for key: " , key ) ;
			execContext.retriesTimers[ key ] = undefined ;
			execContext.tryResponseCounter[ key ][ nextTryIndex ] = 0 ;
			execContext.tryUserResponseCounter[ key ][ nextTryIndex ] = 0 ;
			self.execJob( execContext , execContext.jobsData[ key ] , indexOfKey , nextTryIndex ) ;
		} , timeout ) ;
		
		return ;
	}
	//console.log( "    --> Don't have to retry" ) ;
	
	// If it is an error and posterior tries are in progress
	if ( error && tryIndex < execContext.retriesCounter[ key ] ) { return ; }
	//console.log( "    --> Can proceed results" ) ;
	
	
	// Update stats & results
	execContext.resolved ++ ;
	execContext.pending -- ;
	
	if ( error )
	{
		execContext.failed ++ ;
		if ( error instanceof async.AsyncError && error.message === 'jobTimeout' ) { execContext.jobsStatus[ key ].status = 'timeout' ; }
		else { execContext.jobsStatus[ key ].status = 'failed' ; }
	}
	else
	{
		execContext.ok ++ ;
		execContext.jobsStatus[ key ].status = 'ok' ;
	}
	
	if ( this.castToBoolean && ( ! ( execContext.result instanceof Error ) || ! this.catchAction ) ) { execContext.result = logic ; }
	execContext.results[ key ] = execContext.result ;
	
	
	// Check immediate success or failure
	if ( logic !== this.useLogicAnd && execContext.status === undefined )
	{
		execContext.status = ! this.useLogicAnd ;
		emitResolved = true ;
	}
	
	
	// What to do next?
	if ( execContext.resolved >= length )
	{
		// We have resolved everything
		
		if ( execContext.status === undefined )
		{
			execContext.status = this.useLogicAnd ;
			emitResolved = true ;
		}
		
		emitFinish = true ;
	}
	else if ( execContext.status === undefined )
	{
		// Iterate to the next job if status have not been settled
		
		if ( execContext.iterator < length ) { emitNext =  true ; }
	}
	else if ( execContext.pending <= 0 )
	{
		// No more item are pending, so we can emit 'finish'
		
		emitFinish = true ;
	}
	
	// Emit events, the order matter
	if ( emitResolved ) { execContext.root.emit( 'resolved' , execContext.result ) ; }
	if ( emitNext ) { execContext.root.emit( 'next' , execContext ) ; }
	execContext.root.emit( 'progress' , { resolved: execContext.resolved , pending: execContext.pending , waiting: execContext.waiting , loop: execContext.whileIterator } , execContext.result ) ;
	if ( emitFinish ) { execContext.root.emit( 'finish' , execContext.result ) ; }
}



// What to do when the job is resolved
function execLogicFinal( execContext , result )
{
	// First, the internally registered action
	if ( result instanceof Error )
	{
		if ( this.catchAction ) { this.execAction( execContext , this.catchAction , [ result ] ) ; }
		else if ( this.elseAction ) { this.execAction( execContext , this.elseAction , [ result ] ) ; }
	}
	else if ( ! execContext.result && this.elseAction ) { this.execAction( execContext , this.elseAction , [ result ] ) ; }
	else if ( execContext.result && this.thenAction ) { this.execAction( execContext , this.thenAction , [ result ] ) ; }
	
	if ( this.finallyAction ) { this.execAction( execContext , this.finallyAction , [ result ] ) ; }
	
	
	// Same things, for execContext callback
	if ( result instanceof Error )
	{
		if ( execContext.execCallbacks.catch ) { this.execAction( execContext , execContext.execCallbacks.catch , [ result ] ) ; }
		else if ( execContext.execCallbacks.else ) { this.execAction( execContext , execContext.execCallbacks.else , [ result ] ) ; }
	}
	else if ( ! execContext.result && execContext.execCallbacks.else ) { this.execAction( execContext , execContext.execCallbacks.else , [ result ] ) ; }
	else if ( execContext.result && execContext.execCallbacks.then ) { this.execAction( execContext , execContext.execCallbacks.then , [ result ] ) ; }
	
	if ( execContext.execCallbacks.finally ) { this.execAction( execContext , execContext.execCallbacks.finally , [ result ] ) ; }
}




},{"nextgen-events":4,"tree-kit/lib/extend.js":5}],3:[function(require,module,exports){
/*
	Async Kit
	
	Copyright (c) 2014 - 2016 Cédric Ronvel
	
	The MIT License (MIT)
	
	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:
	
	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



var wrapper = {} ;
module.exports = wrapper ;


// Maybe I should have a look to the 'wrappy' package from npm

wrapper.timeout = function timeout( fn , timeout_ , fnThis )
{
	var fnWrapper = function() {
		
		var this_ = fnThis || this ,
			alreadyCalledBack = false ,
			args = Array.prototype.slice.call( arguments ) ,
			callback = args.pop() ;
		
		var callbackWrapper = function() {
			
			if ( alreadyCalledBack ) { return ; }
			
			alreadyCalledBack = true ;
			callback.apply( this_ , arguments ) ;
		} ;
		
		args.push( callbackWrapper ) ;
		fn.apply( this_ , args ) ;
		
		setTimeout( callbackWrapper.bind( undefined , new Error( 'Timeout' ) ) , timeout_ ) ;
	} ;
	
	// Should we copy own properties of fn into fnWrapper?
	
	return fnWrapper ;
} ;



},{}],4:[function(require,module,exports){
/*
	The Cedric's Swiss Knife (CSK) - CSK NextGen Events
	
	Copyright (c) 2015 Cédric Ronvel 
	
	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



// Create the object && export it
function NextGenEvents() { return Object.create( NextGenEvents.prototype ) ; }
module.exports = NextGenEvents ;





			/* Basic features, more or less compatible with Node.js */



NextGenEvents.SYNC = -Infinity ;

// Not part of the prototype, because it should not pollute userland's prototype.
// It has an eventEmitter as 'this' anyway (always called using call()).
NextGenEvents.init = function init()
{
	Object.defineProperty( this , '__ngev' , { value: {
		nice: NextGenEvents.SYNC ,
		interruptible: false ,
		recursion: 0 ,
		contexts: {} ,
		events: {
			// Special events
			error: [] ,
			interrupt: [] ,
			newListener: [] ,
			removeListener: []
		}
	} } ) ;
} ;



// Use it with .bind()
NextGenEvents.filterOutCallback = function( what , currentElement ) { return what !== currentElement ; } ;



// .addListener( eventName , [fn] , [options] )
NextGenEvents.prototype.addListener = function addListener( eventName , fn , options )
{
	var listener = {} ;
	
	if ( ! this.__ngev ) { NextGenEvents.init.call( this ) ; }
	if ( ! this.__ngev.events[ eventName ] ) { this.__ngev.events[ eventName ] = [] ; }
	
	if ( ! eventName || typeof eventName !== 'string' ) { throw new TypeError( ".addListener(): argument #0 should be a non-empty string" ) ; }
	
	if ( typeof fn !== 'function' )
	{
		options = fn ;
		fn = undefined ;
	}
	
	if ( ! options || typeof options !== 'object' ) { options = {} ; }
	
	listener.fn = fn || options.fn ;
	listener.id = typeof options.id === 'string' ? options.id : listener.fn ;
	listener.once = !! options.once ;
	listener.async = !! options.async ;
	listener.nice = options.nice !== undefined ? Math.floor( options.nice ) : NextGenEvents.SYNC ;
	listener.context = typeof options.context === 'string' ? options.context : null ;
	
	if ( typeof listener.fn !== 'function' )
	{
		throw new TypeError( ".addListener(): a function or an object with a 'fn' property which value is a function should be provided" ) ;
	}
	
	// Implicit context creation
	if ( listener.context && typeof listener.context === 'string' && ! this.__ngev.contexts[ listener.context ] )
	{
		this.addListenerContext( listener.context ) ;
	}
	
	// Note: 'newListener' and 'removeListener' event return an array of listener, but not the event name.
	// So the event's name can be retrieved in the listener itself.
	listener.event = eventName ;
	
	// We should emit 'newListener' first, before adding it to the listeners,
	// to avoid recursion in the case that eventName === 'newListener'
	if ( this.__ngev.events.newListener.length )
	{
		// Return an array, because .addListener() may support multiple event addition at once
		// e.g.: .addListener( { request: onRequest, close: onClose, error: onError } ) ;
		this.emit( 'newListener' , [ listener ] ) ;
	}
	
	this.__ngev.events[ eventName ].push( listener ) ;
	
	return this ;
} ;



NextGenEvents.prototype.on = NextGenEvents.prototype.addListener ;



// Shortcut
NextGenEvents.prototype.once = function once( eventName , options )
{
	if ( ! eventName || typeof eventName !== 'string' ) { throw new TypeError( ".once(): argument #0 should be a non-empty string" ) ; }
	
	if ( typeof options === 'function' )
	{
		options = { id: options , fn: options } ;
	}
	else if ( ! options || typeof options !== 'object' || typeof options.fn !== 'function' )
	{
		throw new TypeError( ".once(): argument #1 should be a function or an object with a 'fn' property which value is a function" ) ;
	}
	
	options.once = true ;
	
	return this.addListener( eventName , options ) ;
} ;



NextGenEvents.prototype.removeListener = function removeListener( eventName , id )
{
	var i , length , newListeners = [] , removedListeners = [] ;
	
	if ( ! eventName || typeof eventName !== 'string' ) { throw new TypeError( ".removeListener(): argument #0 should be a non-empty string" ) ; }
	
	if ( ! this.__ngev ) { NextGenEvents.init.call( this ) ; }
	if ( ! this.__ngev.events[ eventName ] ) { this.__ngev.events[ eventName ] = [] ; }
	
	length = this.__ngev.events[ eventName ].length ;
	
	// It's probably faster to create a new array of listeners
	for ( i = 0 ; i < length ; i ++ )
	{
		if ( this.__ngev.events[ eventName ][ i ].id === id )
		{
			removedListeners.push( this.__ngev.events[ eventName ][ i ] ) ;
		}
		else
		{
			newListeners.push( this.__ngev.events[ eventName ][ i ] ) ;
		}
	}
	
	this.__ngev.events[ eventName ] = newListeners ;
	
	if ( removedListeners.length && this.__ngev.events.removeListener.length )
	{
		this.emit( 'removeListener' , removedListeners ) ;
	}
	
	return this ;
} ;



NextGenEvents.prototype.off = NextGenEvents.prototype.removeListener ;



NextGenEvents.prototype.removeAllListeners = function removeAllListeners( eventName )
{
	var removedListeners ;
	
	if ( ! this.__ngev ) { NextGenEvents.init.call( this ) ; }
	
	if ( eventName )
	{
		// Remove all listeners for a particular event
		
		if ( ! eventName || typeof eventName !== 'string' ) { throw new TypeError( ".removeAllListener(): argument #0 should be undefined or a non-empty string" ) ; }
		
		if ( ! this.__ngev.events[ eventName ] ) { this.__ngev.events[ eventName ] = [] ; }
		
		removedListeners = this.__ngev.events[ eventName ] ;
		this.__ngev.events[ eventName ] = [] ;
		
		if ( removedListeners.length && this.__ngev.events.removeListener.length )
		{
			this.emit( 'removeListener' , removedListeners ) ;
		}
	}
	else
	{
		// Remove all listeners for any events
		// 'removeListener' listeners cannot be triggered: they are already deleted
		this.__ngev.events = {} ;
	}
	
	return this ;
} ;



NextGenEvents.listenerWrapper = function listenerWrapper( listener , event , context )
{
	var returnValue , serial ;
	
	if ( event.interrupt ) { return ; }
	
	if ( listener.async )
	{
		//serial = context && context.serial ;
		if ( context )
		{
			serial = context.serial ;
			context.ready = ! serial ;
		}
		
		returnValue = listener.fn.apply( undefined , event.args.concat( function( arg ) {
			
			event.listenersDone ++ ;
			
			// Async interrupt
			if ( arg && event.emitter.__ngev.interruptible && ! event.interrupt && event.name !== 'interrupt' )
			{
				event.interrupt = arg ;
				
				if ( event.callback )
				{
					event.callback( event.interrupt , event ) ;
					delete event.callback ;
				}
				
				event.emitter.emit( 'interrupt' , event.interrupt ) ;
			}
			else if ( event.listenersDone >= event.listeners && event.callback )
			{
				event.callback( undefined , event ) ;
				delete event.callback ;
			}
			
			// Process the queue if serialized
			if ( serial ) { NextGenEvents.processQueue.call( event.emitter , listener.context , true ) ; }
			
		} ) ) ;
	}
	else
	{
		returnValue = listener.fn.apply( undefined , event.args ) ;
		event.listenersDone ++ ;
	}
	
	// Interrupt if non-falsy return value, if the emitter is interruptible, not already interrupted (emit once),
	// and not within an 'interrupt' event.
	if ( returnValue && event.emitter.__ngev.interruptible && ! event.interrupt && event.name !== 'interrupt' )
	{
		event.interrupt = returnValue ;
		
		if ( event.callback )
		{
			event.callback( event.interrupt , event ) ;
			delete event.callback ;
		}
		
		event.emitter.emit( 'interrupt' , event.interrupt ) ;
	}
	else if ( event.listenersDone >= event.listeners && event.callback )
	{
		event.callback( undefined , event ) ;
		delete event.callback ;
	}
} ;



// A unique event ID
var nextEventId = 0 ;



/*
	emit( [nice] , eventName , [arg1] , [arg2] , [...] , [emitCallback] )
*/
NextGenEvents.prototype.emit = function emit()
{
	var i , iMax , count = 0 ,
		event , listener , context , currentNice ,
		listeners , removedListeners = [] ;
	
	event = {
		emitter: this ,
		id: nextEventId ++ ,
		name: null ,
		args: null ,
		nice: null ,
		interrupt: null ,
		listeners: null ,
		listenersDone: 0 ,
		callback: null ,
	} ;
	
	if ( ! this.__ngev ) { NextGenEvents.init.call( this ) ; }
	
	// Arguments handling
	if ( typeof arguments[ 0 ] === 'number' )
	{
		event.nice = Math.floor( arguments[ 0 ] ) ;
		event.name = arguments[ 1 ] ;
		if ( ! event.name || typeof event.name !== 'string' ) { throw new TypeError( ".emit(): when argument #0 is a number, argument #1 should be a non-empty string" ) ; }
		
		if ( typeof arguments[ arguments.length - 1 ] === 'function' )
		{
			event.callback = arguments[ arguments.length - 1 ] ;
			event.args = Array.prototype.slice.call( arguments , 2 , -1 ) ;
		}
		else
		{
			event.args = Array.prototype.slice.call( arguments , 2 ) ;
		}
	}
	else
	{
		event.nice = this.__ngev.nice ;
		event.name = arguments[ 0 ] ;
		if ( ! event.name || typeof event.name !== 'string' ) { throw new TypeError( ".emit(): argument #0 should be an number or a non-empty string" ) ; }
		event.args = Array.prototype.slice.call( arguments , 1 ) ;
		
		if ( typeof arguments[ arguments.length - 1 ] === 'function' )
		{
			event.callback = arguments[ arguments.length - 1 ] ;
			event.args = Array.prototype.slice.call( arguments , 1 , -1 ) ;
		}
		else
		{
			event.args = Array.prototype.slice.call( arguments , 1 ) ;
		}
	}
	
	
	if ( ! this.__ngev.events[ event.name ] ) { this.__ngev.events[ event.name ] = [] ; }
	
	// Increment this.__ngev.recursion
	event.listeners = this.__ngev.events[ event.name ].length ;
	this.__ngev.recursion ++ ;
	
	// Trouble arise when a listener is removed from another listener, while we are still in the loop.
	// So we have to COPY the listener array right now!
	listeners = this.__ngev.events[ event.name ].slice() ;
	
	for ( i = 0 , iMax = listeners.length ; i < iMax ; i ++ )
	{
		count ++ ;
		listener = listeners[ i ] ;
		context = listener.context && this.__ngev.contexts[ listener.context ] ;
		
		// If the listener context is disabled...
		if ( context && context.status === NextGenEvents.CONTEXT_DISABLED ) { continue ; }
		
		// The nice value for this listener...
		if ( context ) { currentNice = Math.max( event.nice , listener.nice , context.nice ) ; }
		else { currentNice = Math.max( event.nice , listener.nice ) ; }
		
		
		if ( listener.once )
		{
			// We should remove the current listener RIGHT NOW because of recursive .emit() issues:
			// one listener may eventually fire this very same event synchronously during the current loop.
			this.__ngev.events[ event.name ] = this.__ngev.events[ event.name ].filter(
				NextGenEvents.filterOutCallback.bind( undefined , listener )
			) ;
			
			removedListeners.push( listener ) ;
		}
		
		if ( context && ( context.status === NextGenEvents.CONTEXT_QUEUED || ! context.ready ) )
		{
			// Almost all works should be done by .emit(), and little few should be done by .processQueue()
			context.queue.push( { event: event , listener: listener , nice: currentNice } ) ;
		}
		else
		{
			try {
				if ( currentNice < 0 )
				{
					if ( this.__ngev.recursion >= - currentNice )
					{
						setImmediate( NextGenEvents.listenerWrapper.bind( this , listener , event , context ) ) ;
					}
					else
					{
						NextGenEvents.listenerWrapper.call( this , listener , event , context ) ;
					}
				}
				else
				{
					setTimeout( NextGenEvents.listenerWrapper.bind( this , listener , event , context ) , currentNice ) ;
				}
			}
			catch ( error ) {
				// Catch error, just to decrement this.__ngev.recursion, re-throw after that...
				this.__ngev.recursion -- ;
				throw error ;
			}
		}
	}
	
	// Decrement recursion
	this.__ngev.recursion -- ;
	
	// Emit 'removeListener' after calling listeners
	if ( removedListeners.length && this.__ngev.events.removeListener.length )
	{
		this.emit( 'removeListener' , removedListeners ) ;
	}
	
	
	// 'error' event is a special case: it should be listened for, or it will throw an error
	if ( ! count )
	{
		if ( event.name === 'error' )
		{
			if ( arguments[ 1 ] ) { throw arguments[ 1 ] ; }
			else { throw Error( "Uncaught, unspecified 'error' event." ) ; }
		}
		
		if ( event.callback )
		{
			event.callback( undefined , event ) ;
			delete event.callback ;
		}
	}
	
	return event ;
} ;



NextGenEvents.prototype.listeners = function listeners( eventName )
{
	if ( ! eventName || typeof eventName !== 'string' ) { throw new TypeError( ".listeners(): argument #0 should be a non-empty string" ) ; }
	
	if ( ! this.__ngev ) { NextGenEvents.init.call( this ) ; }
	if ( ! this.__ngev.events[ eventName ] ) { this.__ngev.events[ eventName ] = [] ; }
	
	// Do not return the array, shallow copy it
	return this.__ngev.events[ eventName ].slice() ;
} ;



NextGenEvents.listenerCount = function( emitter , eventName )
{
	if ( ! emitter || ! ( emitter instanceof NextGenEvents ) ) { throw new TypeError( ".listenerCount(): argument #0 should be an instance of NextGenEvents" ) ; }
	return emitter.listenerCount( eventName ) ;
} ;



NextGenEvents.prototype.listenerCount = function( eventName )
{
	if ( ! eventName || typeof eventName !== 'string' ) { throw new TypeError( ".listenerCount(): argument #1 should be a non-empty string" ) ; }
	
	if ( ! this.__ngev ) { NextGenEvents.init.call( this ) ; }
	if ( ! this.__ngev.events[ eventName ] ) { this.__ngev.events[ eventName ] = [] ; }
	
	return this.__ngev.events[ eventName ].length ;
} ;



NextGenEvents.prototype.setNice = function setNice( nice )
{
	if ( ! this.__ngev ) { NextGenEvents.init.call( this ) ; }
	//if ( typeof nice !== 'number' ) { throw new TypeError( ".setNice(): argument #0 should be a number" ) ; }
	
	this.__ngev.nice = Math.floor( +nice || 0 ) ;
} ;



NextGenEvents.prototype.setInterruptible = function setInterruptible( value )
{
	if ( ! this.__ngev ) { NextGenEvents.init.call( this ) ; }
	//if ( typeof nice !== 'number' ) { throw new TypeError( ".setNice(): argument #0 should be a number" ) ; }
	
	this.__ngev.interruptible = !! value ;
} ;



// There is no such thing in NextGenEvents, however, we need to be compatible with node.js events at best
NextGenEvents.prototype.setMaxListeners = function() {} ;

// Sometime useful as a no-op callback...
NextGenEvents.noop = function() {} ;





			/* Next Gen feature: contexts! */



NextGenEvents.CONTEXT_ENABLED = 0 ;
NextGenEvents.CONTEXT_DISABLED = 1 ;
NextGenEvents.CONTEXT_QUEUED = 2 ;



NextGenEvents.prototype.addListenerContext = function addListenerContext( contextName , options )
{
	if ( ! this.__ngev ) { NextGenEvents.init.call( this ) ; }
	
	if ( ! contextName || typeof contextName !== 'string' ) { throw new TypeError( ".addListenerContext(): argument #0 should be a non-empty string" ) ; }
	if ( ! options || typeof options !== 'object' ) { options = {} ; }
	
	if ( ! this.__ngev.contexts[ contextName ] )
	{
		// A context IS an event emitter too!
		this.__ngev.contexts[ contextName ] = Object.create( NextGenEvents.prototype ) ;
		this.__ngev.contexts[ contextName ].nice = NextGenEvents.SYNC ;
		this.__ngev.contexts[ contextName ].ready = true ;
		this.__ngev.contexts[ contextName ].status = NextGenEvents.CONTEXT_ENABLED ;
		this.__ngev.contexts[ contextName ].serial = false ;
		this.__ngev.contexts[ contextName ].queue = [] ;
	}
	
	if ( options.nice !== undefined ) { this.__ngev.contexts[ contextName ].nice = Math.floor( options.nice ) ; }
	if ( options.status !== undefined ) { this.__ngev.contexts[ contextName ].status = options.status ; }
	if ( options.serial !== undefined ) { this.__ngev.contexts[ contextName ].serial = !! options.serial ; }
	
	return this ;
} ;



NextGenEvents.prototype.disableListenerContext = function disableListenerContext( contextName )
{
	if ( ! this.__ngev ) { NextGenEvents.init.call( this ) ; }
	if ( ! contextName || typeof contextName !== 'string' ) { throw new TypeError( ".disableListenerContext(): argument #0 should be a non-empty string" ) ; }
	if ( ! this.__ngev.contexts[ contextName ] ) { this.addListenerContext( contextName ) ; }
	
	this.__ngev.contexts[ contextName ].status = NextGenEvents.CONTEXT_DISABLED ;
	
	return this ;
} ;



NextGenEvents.prototype.enableListenerContext = function enableListenerContext( contextName )
{
	if ( ! this.__ngev ) { NextGenEvents.init.call( this ) ; }
	if ( ! contextName || typeof contextName !== 'string' ) { throw new TypeError( ".enableListenerContext(): argument #0 should be a non-empty string" ) ; }
	if ( ! this.__ngev.contexts[ contextName ] ) { this.addListenerContext( contextName ) ; }
	
	this.__ngev.contexts[ contextName ].status = NextGenEvents.CONTEXT_ENABLED ;
	
	if ( this.__ngev.contexts[ contextName ].queue.length > 0 ) { NextGenEvents.processQueue.call( this , contextName ) ; }
	
	return this ;
} ;



NextGenEvents.prototype.queueListenerContext = function queueListenerContext( contextName )
{
	if ( ! this.__ngev ) { NextGenEvents.init.call( this ) ; }
	if ( ! contextName || typeof contextName !== 'string' ) { throw new TypeError( ".queueListenerContext(): argument #0 should be a non-empty string" ) ; }
	if ( ! this.__ngev.contexts[ contextName ] ) { this.addListenerContext( contextName ) ; }
	
	this.__ngev.contexts[ contextName ].status = NextGenEvents.CONTEXT_QUEUED ;
	
	return this ;
} ;



NextGenEvents.prototype.serializeListenerContext = function serializeListenerContext( contextName , value )
{
	if ( ! this.__ngev ) { NextGenEvents.init.call( this ) ; }
	if ( ! contextName || typeof contextName !== 'string' ) { throw new TypeError( ".serializeListenerContext(): argument #0 should be a non-empty string" ) ; }
	if ( ! this.__ngev.contexts[ contextName ] ) { this.addListenerContext( contextName ) ; }
	
	this.__ngev.contexts[ contextName ].serial = value === undefined ? true : !! value ;
	
	return this ;
} ;



NextGenEvents.prototype.setListenerContextNice = function setListenerContextNice( contextName , nice )
{
	if ( ! this.__ngev ) { NextGenEvents.init.call( this ) ; }
	if ( ! contextName || typeof contextName !== 'string' ) { throw new TypeError( ".setListenerContextNice(): argument #0 should be a non-empty string" ) ; }
	if ( ! this.__ngev.contexts[ contextName ] ) { this.addListenerContext( contextName ) ; }
	
	this.__ngev.contexts[ contextName ].nice = Math.floor( nice ) ;
	
	return this ;
} ;



NextGenEvents.prototype.destroyListenerContext = function destroyListenerContext( contextName )
{
	var i , length , eventName , newListeners , removedListeners = [] ;
	
	if ( ! contextName || typeof contextName !== 'string' ) { throw new TypeError( ".disableListenerContext(): argument #0 should be a non-empty string" ) ; }
	
	if ( ! this.__ngev ) { NextGenEvents.init.call( this ) ; }
	
	// We don't care if a context actually exists, all listeners tied to that contextName will be removed
	
	for ( eventName in this.__ngev.events )
	{
		newListeners = null ;
		length = this.__ngev.events[ eventName ].length ;
		
		for ( i = 0 ; i < length ; i ++ )
		{
			if ( this.__ngev.events[ eventName ][ i ].context === contextName )
			{
				newListeners = [] ;
				removedListeners.push( this.__ngev.events[ eventName ][ i ] ) ;
			}
			else if ( newListeners )
			{
				newListeners.push( this.__ngev.events[ eventName ][ i ] ) ;
			}
		}
		
		if ( newListeners ) { this.__ngev.events[ eventName ] = newListeners ; }
	}
	
	if ( this.__ngev.contexts[ contextName ] ) { delete this.__ngev.contexts[ contextName ] ; }
	
	if ( removedListeners.length && this.__ngev.events.removeListener.length )
	{
		this.emit( 'removeListener' , removedListeners ) ;
	}
	
	return this ;
} ;



// To be used with .call(), it should not pollute the prototype
NextGenEvents.processQueue = function processQueue( contextName , isCompletionCallback )
{
	var context , job ;
	
	// The context doesn't exist anymore, so just abort now
	if ( ! this.__ngev.contexts[ contextName ] ) { return ; }
	
	context = this.__ngev.contexts[ contextName ] ;
	
	if ( isCompletionCallback ) { context.ready = true ; }
	
	// Should work on serialization here
	
	//console.log( ">>> " , context ) ;
	
	// Increment recursion
	this.__ngev.recursion ++ ;
	
	while ( context.ready && context.queue.length )
	{
		job = context.queue.shift() ;
		
		// This event has been interrupted, drop it now!
		if ( job.event.interrupt ) { continue ; }
		
		try {
			if ( job.nice < 0 )
			{
				if ( this.__ngev.recursion >= - job.nice )
				{
					setImmediate( NextGenEvents.listenerWrapper.bind( this , job.listener , job.event , context ) ) ;
				}
				else
				{
					NextGenEvents.listenerWrapper.call( this , job.listener , job.event , context ) ;
				}
			}
			else
			{
				setTimeout( NextGenEvents.listenerWrapper.bind( this , job.listener , job.event , context ) , job.nice ) ;
			}
		}
		catch ( error ) {
			// Catch error, just to decrement this.__ngev.recursion, re-throw after that...
			this.__ngev.recursion -- ;
			throw error ;
		}
	}
	
	// Decrement recursion
	this.__ngev.recursion -- ;
} ;




},{}],5:[function(require,module,exports){
/*
	The Cedric's Swiss Knife (CSK) - CSK object tree toolbox

	Copyright (c) 2014, 2015 Cédric Ronvel 
	
	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



/*
	== Extend function ==
*/

/*
	options:
		* own: only copy own properties that are enumerable
		* nonEnum: copy non-enumerable properties as well, works only with own:true
		* descriptor: preserve property's descriptor
		* deep: perform a deep (recursive) extend
		* maxDepth: used in conjunction with deep, when max depth is reached an exception is raised, default to 100 when
			the 'circular' option is off, or default to null if 'circular' is on
		* circular: circular references reconnection
		* move: move properties to target (delete properties from the sources)
		* preserve: existing properties in the target object are not overwritten
		* nofunc: skip functions
		* deepFunc: in conjunction with 'deep', this will process sources functions like objects rather than
			copying/referencing them directly into the source, thus, the result will not be a function, it forces 'deep'
		* proto: try to clone objects with the right prototype, using Object.create() or mutating it with __proto__,
			it forces option 'own'.
		* inherit: rather than mutating target prototype for source prototype like the 'proto' option does, here it is
			the source itself that IS the prototype for the target. Force option 'own' and disable 'proto'.
		* skipRoot: the prototype of the target root object is NOT mutated only if this option is set.
		* flat: extend into the target top-level only, compose name with the path of the source, force 'deep',
			disable 'unflat', 'proto', 'inherit'
		* unflat: assume sources are in the 'flat' format, expand all properties deeply into the target, disable 'flat'
		* deepFilter
			* blacklist: list of black-listed prototype: the recursiveness of the 'deep' option will be disabled
				for object whose prototype is listed
			* whitelist: the opposite of blacklist
*/
function extend( runtime , options , target )
{
	var i , j , jmax , source , sourceKeys , sourceKey , sourceValue ,
		value , sourceDescriptor , targetKey , targetPointer , path ,
		indexOfSource = -1 , newTarget = false , length = arguments.length ;
	
	if ( ! options || typeof options !== 'object' ) { options = {} ; }
	
	// Things applied only for the first call, not for recursive call
	if ( ! runtime )
	{
		runtime = { depth: 0 , prefix: '' } ;
		
		if ( ! options.maxDepth && options.deep && ! options.circular ) { options.maxDepth = 100 ; }
		
		if ( options.deepFunc ) { options.deep = true ; }
		
		if ( options.deepFilter && typeof options.deepFilter === 'object' )
		{
			if ( options.deepFilter.whitelist && ( ! Array.isArray( options.deepFilter.whitelist ) || ! options.deepFilter.whitelist.length ) ) { delete options.deepFilter.whitelist ; }
			if ( options.deepFilter.blacklist && ( ! Array.isArray( options.deepFilter.blacklist ) || ! options.deepFilter.blacklist.length ) ) { delete options.deepFilter.blacklist ; }
			if ( ! options.deepFilter.whitelist && ! options.deepFilter.blacklist ) { delete options.deepFilter ; }
		}
		
		// 'flat' option force 'deep'
		if ( options.flat )
		{
			options.deep = true ;
			options.proto = false ;
			options.inherit = false ;
			options.unflat = false ;
			if ( typeof options.flat !== 'string' ) { options.flat = '.' ; }
		}
		
		if ( options.unflat )
		{
			options.deep = false ;
			options.proto = false ;
			options.inherit = false ;
			options.flat = false ;
			if ( typeof options.unflat !== 'string' ) { options.unflat = '.' ; }
		}
		
		// If the prototype is applied, only owned properties should be copied
		if ( options.inherit ) { options.own = true ; options.proto = false ; }
		else if ( options.proto ) { options.own = true ; }
		
		if ( ! target || ( typeof target !== 'object' && typeof target !== 'function' ) )
		{
			newTarget = true ;
		}
		
		if ( ! options.skipRoot && ( options.inherit || options.proto ) )
		{
			for ( i = length - 1 ; i >= 3 ; i -- )
			{
				source = arguments[ i ] ;
				if ( source && ( typeof source === 'object' || typeof source === 'function' ) )
				{
					if ( options.inherit )
					{
						if ( newTarget ) { target = Object.create( source ) ; }
						else { target.__proto__ = source ; }	// jshint ignore:line
					}
					else if ( options.proto )
					{
						if ( newTarget ) { target = Object.create( source.__proto__ ) ; }	// jshint ignore:line
						else { target.__proto__ = source.__proto__ ; }	// jshint ignore:line
					}
					
					break ;
				}
			}
		}
		else if ( newTarget )
		{
			target = {} ;
		}
		
		runtime.references = { sources: [] , targets: [] } ;
	}
	
	
	// Max depth check
	if ( options.maxDepth && runtime.depth > options.maxDepth )
	{
		throw new Error( '[tree] extend(): max depth reached(' + options.maxDepth + ')' ) ;
	}
	
	
	// Real extend processing part
	for ( i = 3 ; i < length ; i ++ )
	{
		source = arguments[ i ] ;
		if ( ! source || ( typeof source !== 'object' && typeof source !== 'function' ) ) { continue ; }
		
		if ( options.circular )
		{
			runtime.references.sources.push( source ) ;
			runtime.references.targets.push( target ) ;
		}
		
		if ( options.own )
		{
			if ( options.nonEnum ) { sourceKeys = Object.getOwnPropertyNames( source ) ; }
			else { sourceKeys = Object.keys( source ) ; }
		}
		else { sourceKeys = source ; }
		
		for ( sourceKey in sourceKeys )
		{
			if ( options.own ) { sourceKey = sourceKeys[ sourceKey ] ; }
			
			// If descriptor is on, get it now
			if ( options.descriptor )
			{
				sourceDescriptor = Object.getOwnPropertyDescriptor( source , sourceKey ) ;
				sourceValue = sourceDescriptor.value ;
			}
			else
			{
				// We have to trigger an eventual getter only once
				sourceValue = source[ sourceKey ] ;
			}
			
			targetPointer = target ;
			targetKey = runtime.prefix + sourceKey ;
			
			// Do not copy if property is a function and we don't want them
			if ( options.nofunc && typeof sourceValue === 'function' ) { continue; }
			
			// 'unflat' mode computing
			if ( options.unflat && runtime.depth === 0 )
			{
				path = sourceKey.split( options.unflat ) ;
				jmax = path.length - 1 ;
				
				if ( jmax )
				{
					for ( j = 0 ; j < jmax ; j ++ )
					{
						if ( ! targetPointer[ path[ j ] ] ||
							( typeof targetPointer[ path[ j ] ] !== 'object' &&
								typeof targetPointer[ path[ j ] ] !== 'function' ) )
						{
							targetPointer[ path[ j ] ] = {} ;
						}
						
						targetPointer = targetPointer[ path[ j ] ] ;
					}
					
					targetKey = runtime.prefix + path[ jmax ] ;
				}
			}
			
			
			if ( options.deep &&
				sourceValue &&
				( typeof sourceValue === 'object' || ( options.deepFunc && typeof sourceValue === 'function' ) ) &&
				( ! options.descriptor || ! sourceDescriptor.get ) &&
				( ! options.deepFilter ||
					( ( ! options.deepFilter.whitelist || options.deepFilter.whitelist.indexOf( sourceValue.__proto__ ) !== -1 ) &&	// jshint ignore:line
						( ! options.deepFilter.blacklist || options.deepFilter.blacklist.indexOf( sourceValue.__proto__ ) === -1 ) ) ) ) // jshint ignore:line
			{
				if ( options.circular )
				{
					indexOfSource = runtime.references.sources.indexOf( sourceValue ) ;
				}
				
				if ( options.flat )
				{
					// No circular references reconnection when in 'flat' mode
					if ( indexOfSource >= 0 ) { continue ; }
					
					extend(
						{ depth: runtime.depth + 1 , prefix: runtime.prefix + sourceKey + options.flat , references: runtime.references } ,
						options , targetPointer , sourceValue
					) ;
				}
				else
				{
					if ( indexOfSource >= 0 )
					{
						// Circular references reconnection...
						if ( options.descriptor )
						{
							Object.defineProperty( targetPointer , targetKey , {
								value: runtime.references.targets[ indexOfSource ] ,
								enumerable: sourceDescriptor.enumerable ,
								writable: sourceDescriptor.writable ,
								configurable: sourceDescriptor.configurable
							} ) ;
						}
						else
						{
							targetPointer[ targetKey ] = runtime.references.targets[ indexOfSource ] ;
						}
						
						continue ;
					}
					
					if ( ! targetPointer[ targetKey ] || ! targetPointer.hasOwnProperty( targetKey ) || ( typeof targetPointer[ targetKey ] !== 'object' && typeof targetPointer[ targetKey ] !== 'function' ) )
					{
						if ( Array.isArray( sourceValue ) ) { value = [] ; }
						else if ( options.proto ) { value = Object.create( sourceValue.__proto__ ) ; }	// jshint ignore:line
						else if ( options.inherit ) { value = Object.create( sourceValue ) ; }
						else { value = {} ; }
						
						if ( options.descriptor )
						{
							Object.defineProperty( targetPointer , targetKey , {
								value: value ,
								enumerable: sourceDescriptor.enumerable ,
								writable: sourceDescriptor.writable ,
								configurable: sourceDescriptor.configurable
							} ) ;
						}
						else
						{
							targetPointer[ targetKey ] = value ;
						}
					}
					else if ( options.proto && targetPointer[ targetKey ].__proto__ !== sourceValue.__proto__ )	// jshint ignore:line
					{
						targetPointer[ targetKey ].__proto__ = sourceValue.__proto__ ;	// jshint ignore:line
					}
					else if ( options.inherit && targetPointer[ targetKey ].__proto__ !== sourceValue )	// jshint ignore:line
					{
						targetPointer[ targetKey ].__proto__ = sourceValue ;	// jshint ignore:line
					}
					
					if ( options.circular )
					{
						runtime.references.sources.push( sourceValue ) ;
						runtime.references.targets.push( targetPointer[ targetKey ] ) ;
					}
					
					// Recursively extends sub-object
					extend(
						{ depth: runtime.depth + 1 , prefix: '' , references: runtime.references } ,
						options , targetPointer[ targetKey ] , sourceValue
					) ;
				}
			}
			else if ( options.preserve && targetPointer[ targetKey ] !== undefined )
			{
				// Do not overwrite, and so do not delete source's properties that were not moved
				continue ;
			}
			else if ( ! options.inherit )
			{
				if ( options.descriptor ) { Object.defineProperty( targetPointer , targetKey , sourceDescriptor ) ; }
				else { targetPointer[ targetKey ] = sourceValue ; }
			}
			
			// Delete owned property of the source object
			if ( options.move ) { delete source[ sourceKey ] ; }
		}
	}
	
	return target ;
}



// The extend() method as publicly exposed
module.exports = extend.bind( undefined , null ) ;



},{}]},{},[1])(1)
});